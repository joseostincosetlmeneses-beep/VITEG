import { Router } from "express";
import { z } from "zod";
import { AppError, asyncHandler } from "../lib/http.js";
import { requireAuth } from "../middleware/auth.js";
import { Conversation, Message } from "../models/index.js";

export const messagingRouter = Router();
messagingRouter.use(requireAuth);

messagingRouter.get(
  "/conversations",
  asyncHandler(async (request, response) => {
    const conversations = await Conversation.find({ tenantId: "default", participants: request.user!.id })
      .populate("participants", "firstName lastName role photoUrl")
      .populate("routeId", "name date status")
      .sort({ lastMessageAt: -1 });
    response.json({ data: conversations });
  })
);

messagingRouter.post(
  "/conversations",
  asyncHandler(async (request, response) => {
    const input = z.object({
      type: z.enum(["DIRECT", "ROUTE"]),
      participantIds: z.array(z.string()).min(1),
      routeId: z.string().optional()
    }).parse(request.body);
    const participants = [...new Set([request.user!.id, ...input.participantIds])];
    const conversation = await Conversation.create({ ...input, participants, tenantId: "default", lastMessageAt: new Date() });
    response.status(201).json({ data: conversation });
  })
);

messagingRouter.get(
  "/conversations/:id/messages",
  asyncHandler(async (request, response) => {
    const conversation = await Conversation.findOne({ _id: request.params.id, tenantId: "default", participants: request.user!.id });
    if (!conversation) throw new AppError(404, "Conversación no encontrada");
    const messages = await Message.find({ tenantId: "default", conversationId: conversation._id })
      .populate("senderId", "firstName lastName role photoUrl")
      .sort({ createdAt: 1 })
      .limit(200);
    response.json({ data: messages });
  })
);

messagingRouter.post(
  "/conversations/:id/messages",
  asyncHandler(async (request, response) => {
    const input = z.object({
      type: z.enum(["TEXT", "IMAGE", "LOCATION"]).default("TEXT"),
      text: z.string().max(2000).optional(),
      attachments: z.array(z.object({ url: z.string(), storageKey: z.string().optional(), kind: z.enum(["IMAGE", "DOCUMENT"]) })).default([]),
      location: z.object({ latitude: z.number(), longitude: z.number() }).optional()
    }).parse(request.body);
    const conversation = await Conversation.findOne({ _id: request.params.id, tenantId: "default", participants: request.user!.id });
    if (!conversation) throw new AppError(404, "Conversación no encontrada");
    const message = await Message.create({
      ...input,
      tenantId: "default",
      conversationId: conversation._id,
      senderId: request.user!.id,
      readBy: [request.user!.id]
    });
    conversation.lastMessageAt = new Date();
    await conversation.save();
    response.status(201).json({ data: message });
  })
);

