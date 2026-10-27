import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { ActivityLog } from "../models/index.js";

export const activityRouter = Router();
activityRouter.use(requireAuth, allowRoles("ADMIN"));

activityRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const limit = Math.min(Math.max(Number(request.query.limit) || 100, 1), 200);
    const activity = await ActivityLog.find({ tenantId: "default" })
      .populate("actorId", "firstName lastName role")
      .populate("targetUserId", "firstName lastName role")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    response.json({ data: activity });
  })
);
