import type { SessionUser } from "@viteg/shared";
import { ActivityLog } from "../models/index.js";

export async function recordActivity(input: {
  actor: SessionUser;
  action: string;
  entityType: string;
  entityId?: unknown;
  entityLabel?: string;
  targetUserId?: unknown;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await ActivityLog.create({
      tenantId: "default",
      actorId: input.actor.id,
      actorName: input.actor.name,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      entityLabel: input.entityLabel,
      targetUserId: input.targetUserId,
      summary: input.summary,
      metadata: input.metadata
    });
  } catch (error) {
    console.error("No se pudo registrar la actividad", error);
  }
}

export function documentLabel(document: any): string {
  return document?.name
    || document?.businessName
    || document?.alias
    || document?.code
    || `${document?.firstName ?? ""} ${document?.lastName ?? ""}`.trim()
    || "Sin nombre";
}
