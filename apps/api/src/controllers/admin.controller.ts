import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { cache } from "../lib/cache";
import { apiError } from "../lib/errors";
import type { VerificationStatus } from "@prisma/client";

async function writeAdminLog(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await prisma.adminLog.create({
    data: {
      adminId,
      action,
      targetType,
      targetId,
      metadata: metadata !== undefined
        ? (metadata as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  });
}

// GET /api/v1/admin/organizers
export async function listOrganizers(req: Request, res: Response): Promise<void> {
  const { cursor, limit, verificationStatus } = req.query as Record<string, string | undefined>;
  const take = Math.min(parseInt(limit ?? "20", 10) || 20, 100);

  const organizers = await prisma.organizerProfile.findMany({
    ...(verificationStatus
      ? { where: { verificationStatus: verificationStatus as VerificationStatus } }
      : {}),
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { id: "asc" },
    include: { user: { select: { id: true, phone: true, name: true, createdAt: true } } },
  });

  const hasMore = organizers.length > take;
  const items = hasMore ? organizers.slice(0, take) : organizers;

  res.json({
    data: items,
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
    hasMore,
  });
}

// PUT /api/v1/admin/organizers/:id/verify
export async function verifyOrganizer(req: Request, res: Response): Promise<void> {
  const adminId = req.user!.userId;
  const { id: organizerId } = req.params as { id: string };
  const { status, notes } = req.body as { status: VerificationStatus; notes?: string };

  const profile = await prisma.organizerProfile.findUnique({ where: { id: organizerId } });
  if (!profile) {
    apiError(res, 404, "Organizer not found", "ORGANIZER_NOT_FOUND");
    return;
  }

  const updated = await prisma.organizerProfile.update({
    where: { id: organizerId },
    data: { verificationStatus: status, adminNotes: notes ?? null },
  });

  await writeAdminLog(adminId, `VERIFY_ORGANIZER:${status}`, "OrganizerProfile", organizerId, {
    previousStatus: profile.verificationStatus,
    newStatus: status,
    notes,
  });

  res.json({ data: updated });
}

// GET /api/v1/admin/events
export async function listAllEvents(req: Request, res: Response): Promise<void> {
  const { cursor, limit, status } = req.query as Record<string, string | undefined>;
  const take = Math.min(parseInt(limit ?? "20", 10) || 20, 100);

  const events = await prisma.event.findMany({
    where: {
      deletedAt: null,
      ...(status ? { status: status as never } : {}),
    },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      organizer: { select: { id: true, orgName: true, verificationStatus: true } },
      sponsorshipPackages: true,
    },
  });

  const hasMore = events.length > take;
  const items = hasMore ? events.slice(0, take) : events;

  res.json({
    data: items,
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
    hasMore,
  });
}

// PUT /api/v1/admin/events/:id/approve
export async function approveEvent(req: Request, res: Response): Promise<void> {
  const adminId = req.user!.userId;
  const { id: eventId } = req.params as { id: string };

  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
  });

  if (!event) {
    apiError(res, 404, "Event not found", "EVENT_NOT_FOUND");
    return;
  }

  if (event.status !== "PENDING_APPROVAL") {
    apiError(res, 422, "Only PENDING_APPROVAL events can be approved", "INVALID_STATUS");
    return;
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: { status: "LIVE", rejectionReason: null },
  });

  await cache.invalidatePattern("events:list:*");

  await writeAdminLog(adminId, "APPROVE_EVENT", "Event", eventId, {
    title: event.title,
    previousStatus: event.status,
  });

  res.json({ data: updated });
}

// PUT /api/v1/admin/events/:id/reject
export async function rejectEvent(req: Request, res: Response): Promise<void> {
  const adminId = req.user!.userId;
  const { id: eventId } = req.params as { id: string };
  const { reason } = req.body as { reason?: string };

  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
  });

  if (!event) {
    apiError(res, 404, "Event not found", "EVENT_NOT_FOUND");
    return;
  }

  if (event.status !== "PENDING_APPROVAL") {
    apiError(res, 422, "Only PENDING_APPROVAL events can be rejected", "INVALID_STATUS");
    return;
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: { status: "REJECTED", rejectionReason: reason ?? null },
  });

  await cache.invalidatePattern("events:list:*");

  await writeAdminLog(adminId, "REJECT_EVENT", "Event", eventId, {
    title: event.title,
    reason,
    previousStatus: event.status,
  });

  res.json({ data: updated });
}

// GET /api/v1/admin/logs
export async function getAdminLogs(req: Request, res: Response): Promise<void> {
  const { cursor, limit, targetType, action } = req.query as Record<string, string | undefined>;
  const take = Math.min(parseInt(limit ?? "50", 10) || 50, 200);

  const logs = await prisma.adminLog.findMany({
    where: {
      ...(targetType ? { targetType } : {}),
      ...(action ? { action: { contains: action } } : {}),
    },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: { admin: { select: { id: true, name: true, phone: true } } },
  });

  const hasMore = logs.length > take;
  const items = hasMore ? logs.slice(0, take) : logs;

  res.json({
    data: items,
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
    hasMore,
  });
}
