import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { AppError, asyncHandler } from "../lib/http.js";
import { requireAuth } from "../middleware/auth.js";
import { Conversation, Message, User } from "../models/index.js";

const uploadDirectory = path.resolve(process.cwd(), "uploads", "chat");
fs.mkdirSync(uploadDirectory, { recursive: true });

const extensionByMime: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "video/3gpp": ".3gp"
};

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_request, file, callback) => {
      const extension = extensionByMime[file.mimetype] ?? path.extname(file.originalname).toLowerCase();
      callback(null, `${randomUUID()}${extension}`);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) callback(null, true);
    else callback(new AppError(415, "Solo se permiten imágenes y videos"));
  }
});

const attachmentSchema = z.object({
  url: z.string().min(1),
  storageKey: z.string().optional(),
  kind: z.enum(["IMAGE", "VIDEO"]),
  name: z.string().max(255).optional(),
  mimeType: z.string().max(100).optional(),
  size: z.number().nonnegative().optional()
});

async function conversationForUser(id: string, userId: string) {
  return Conversation.findOne({ _id: id, tenantId: "default", participants: userId });
}

export const messagingRouter = Router();
messagingRouter.use(requireAuth);

messagingRouter.get(
  "/workers",
  asyncHandler(async (request, response) => {
    const workers = await User.find({
      tenantId: "default",
      status: "ACTIVE",
      _id: { $ne: request.user!.id }
    })
      .select("firstName lastName role photoUrl status")
      .sort({ firstName: 1, lastName: 1 });
    response.json({ data: workers });
  })
);

messagingRouter.get(
  "/conversations",
  asyncHandler(async (request, response) => {
    const conversations = await Conversation.find({ tenantId: "default", participants: request.user!.id })
      .populate("participants", "firstName lastName role photoUrl status")
      .populate("routeId", "name date status")
      .sort({ lastMessageAt: -1 })
      .lean();
    const data = await Promise.all(conversations.map(async (conversation: any) => {
      const [lastMessage, unreadCount] = await Promise.all([
        Message.findOne({ tenantId: "default", conversationId: conversation._id })
          .sort({ createdAt: -1 })
          .select("type text attachments senderId createdAt")
          .lean(),
        Message.countDocuments({
          tenantId: "default",
          conversationId: conversation._id,
          senderId: { $ne: request.user!.id },
          readBy: { $ne: request.user!.id }
        })
      ]);
      return { ...conversation, lastMessage, unreadCount };
    }));
    response.json({ data });
  })
);

messagingRouter.post(
  "/conversations",
  asyncHandler(async (request, response) => {
    const input = z.object({ participantId: z.string().min(1) }).parse(request.body);
    if (input.participantId === request.user!.id) throw new AppError(400, "No puedes conversar contigo mismo");
    const worker = await User.exists({ _id: input.participantId, tenantId: "default", status: "ACTIVE" });
    if (!worker) throw new AppError(404, "Trabajador no encontrado o inactivo");
    const participantIds = [request.user!.id, input.participantId];
    let conversation = await Conversation.findOne({
      tenantId: "default",
      type: "DIRECT",
      participants: { $all: participantIds, $size: 2 }
    });
    if (!conversation) {
      conversation = await Conversation.create({
        tenantId: "default",
        type: "DIRECT",
        participants: participantIds,
        lastMessageAt: new Date()
      });
    }
    await conversation.populate("participants", "firstName lastName role photoUrl status");
    response.status(201).json({ data: conversation });
  })
);

messagingRouter.get(
  "/conversations/:id/messages",
  asyncHandler(async (request, response) => {
    const conversation = await conversationForUser(String(request.params.id), request.user!.id);
    if (!conversation) throw new AppError(404, "Conversación no encontrada");
    const messages = await Message.find({ tenantId: "default", conversationId: conversation._id })
      .populate("senderId", "firstName lastName role photoUrl")
      .sort({ createdAt: 1 })
      .limit(300);
    await Message.updateMany(
      { conversationId: conversation._id, senderId: { $ne: request.user!.id }, readBy: { $ne: request.user!.id } },
      { $addToSet: { readBy: request.user!.id } }
    );
    response.json({ data: messages });
  })
);

messagingRouter.post(
  "/conversations/:id/messages",
  asyncHandler(async (request, response) => {
    const input = z.object({
      type: z.enum(["TEXT", "IMAGE", "VIDEO"]).default("TEXT"),
      text: z.string().trim().max(2000).optional(),
      attachments: z.array(attachmentSchema).max(1).default([])
    }).refine((value) => Boolean(value.text) || value.attachments.length > 0, "El mensaje está vacío").parse(request.body);
    const conversation = await conversationForUser(String(request.params.id), request.user!.id);
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
    await message.populate("senderId", "firstName lastName role photoUrl");
    response.status(201).json({ data: message });
  })
);

messagingRouter.post(
  "/media",
  upload.single("file"),
  asyncHandler(async (request, response) => {
    if (!request.file) throw new AppError(400, "Selecciona una imagen o video");
    const kind = request.file.mimetype.startsWith("video/") ? "VIDEO" : "IMAGE";
    const url = `${request.protocol}://${request.get("host")}/uploads/chat/${request.file.filename}`;
    response.status(201).json({
      data: {
        url,
        storageKey: `chat/${request.file.filename}`,
        kind,
        name: request.file.originalname,
        mimeType: request.file.mimetype,
        size: request.file.size
      }
    });
  })
);
