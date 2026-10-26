import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { z } from "zod";
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
        const input = z.object({
          conversationId: z.string().min(1),
          type: z.enum(["TEXT", "IMAGE", "VIDEO"]).default("TEXT"),
          text: z.string().trim().max(2000).optional(),
          attachments: z.array(z.object({
            url: z.string().min(1),
            storageKey: z.string().optional(),
            kind: z.enum(["IMAGE", "VIDEO"]),
            name: z.string().optional(),
            mimeType: z.string().optional(),
            size: z.number().nonnegative().optional()
          })).max(1).default([])
        }).refine((value) => Boolean(value.text) || value.attachments.length > 0).parse(payload);
        const conversation = await Conversation.findOne({ _id: input.conversationId, tenantId: "default", participants: user.id });
        if (!conversation) throw new Error("FORBIDDEN");
        const message = await Message.create({
          tenantId: "default",
          conversationId: conversation._id,
          senderId: user.id,
          type: input.type,
          text: input.text,
          attachments: input.attachments,
          readBy: [user.id]
        });
        conversation.lastMessageAt = new Date();
        await conversation.save();
        await message.populate("senderId", "firstName lastName role photoUrl");
        for (const participantId of conversation.participants) {
          io.to(`user:${String(participantId)}`).emit("message:new", message);
        }
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

