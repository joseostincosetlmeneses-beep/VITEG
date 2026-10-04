import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import type { SessionUser } from "@viteg/shared";
import { env } from "./config.js";
import { Conversation, DriverLocation, Message, Route } from "./models/index.js";

export function createRealtimeServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, { cors: { origin: env.CLIENT_ORIGIN } });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token as string;
      socket.data.user = jwt.verify(token, env.JWT_SECRET) as SessionUser;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as SessionUser;
    socket.join(`user:${user.id}`);
    if (user.role === "ADMIN") socket.join("admins");

    socket.on("conversation:join", async (conversationId: string, acknowledge) => {
      const allowed = await Conversation.exists({ _id: conversationId, tenantId: "default", participants: user.id });
      if (!allowed) return acknowledge?.({ ok: false, error: "FORBIDDEN" });
      socket.join(`conversation:${conversationId}`);
      acknowledge?.({ ok: true });
    });

    socket.on("message:send", async (payload, acknowledge) => {
      try {
        const conversation = await Conversation.findOne({ _id: payload.conversationId, tenantId: "default", participants: user.id });
        if (!conversation) throw new Error("FORBIDDEN");
        const message = await Message.create({
          tenantId: "default",
          conversationId: conversation._id,
          senderId: user.id,
          type: payload.type ?? "TEXT",
          text: payload.text,
          attachments: payload.attachments ?? [],
          location: payload.location,
          readBy: [user.id]
        });
        conversation.lastMessageAt = new Date();
        await conversation.save();
        io.to(`conversation:${conversation.id}`).emit("message:new", message);
        acknowledge?.({ ok: true, data: message });
      } catch (error) {
        acknowledge?.({ ok: false, error: error instanceof Error ? error.message : "ERROR" });
      }
    });

    socket.on("location:update", async (payload, acknowledge) => {
      try {
        if (user.role !== "DRIVER") throw new Error("FORBIDDEN");
        const route = await Route.findOne({ _id: payload.routeId, driverId: user.id, status: { $in: ["IN_PROGRESS", "PAUSED"] } });
        if (!route) throw new Error("ROUTE_NOT_ACTIVE");
        const location = await DriverLocation.create({ ...payload, tenantId: "default", driverId: user.id, recordedAt: new Date() });
        io.to("admins").emit("driver:location", location);
        acknowledge?.({ ok: true });
      } catch (error) {
        acknowledge?.({ ok: false, error: error instanceof Error ? error.message : "ERROR" });
      }
    });
  });

  return io;
}

