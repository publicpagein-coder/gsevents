import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { apiError } from "../lib/errors";

// POST /api/v1/organizer/profile
export async function upsertOrganizerProfile(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { orgName, societyName, venueName, socialLink } = req.body as {
    orgName: string;
    societyName?: string;
    venueName?: string;
    socialLink?: string;
  };

  const existing = await prisma.organizerProfile.findUnique({ where: { userId } });

  if (existing) {
    const profile = await prisma.organizerProfile.update({
      where: { userId },
      data: {
        orgName,
        societyName: societyName ?? null,
        venueName: venueName ?? null,
        socialLink: socialLink ?? null,
      },
    });
    res.json({ data: profile });
  } else {
    // Also promote user role to ORGANIZER if not already
    await prisma.user.update({ where: { id: userId }, data: { role: "ORGANIZER" } });
    const profile = await prisma.organizerProfile.create({
      data: {
        userId,
        orgName,
        societyName: societyName ?? null,
        venueName: venueName ?? null,
        socialLink: socialLink ?? null,
      },
    });
    res.status(201).json({ data: profile });
  }
}

// GET /api/v1/organizer/profile
export async function getOrganizerProfile(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const profile = await prisma.organizerProfile.findUnique({
    where: { userId },
    include: { user: { select: { id: true, phone: true, name: true, role: true } } },
  });

  if (!profile) {
    apiError(res, 404, "Organizer profile not found", "PROFILE_NOT_FOUND");
    return;
  }

  res.json({ data: profile });
}

// GET /api/v1/organizer/events
export async function getOrganizerEvents(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { cursor, limit = "20", status } = req.query as {
    cursor?: string;
    limit?: string;
    status?: string;
  };

  const take = Math.min(parseInt(limit, 10) || 20, 100);

  const profile = await prisma.organizerProfile.findUnique({ where: { userId } });
  if (!profile) {
    apiError(res, 404, "Organizer profile not found", "PROFILE_NOT_FOUND");
    return;
  }

  const where = {
    organizerId: profile.id,
    deletedAt: null,
    ...(status ? { status: status as never } : {}),
  };

  const events = await prisma.event.findMany({
    where,
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: { sponsorshipPackages: true },
  });

  const hasMore = events.length > take;
  const items = hasMore ? events.slice(0, take) : events;

  res.json({
    data: items,
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
    hasMore,
  });
}

// GET /api/v1/organizer/events/:id/interests
export async function getEventInterests(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: eventId } = req.params as { id: string };

  const profile = await prisma.organizerProfile.findUnique({ where: { userId } });
  if (!profile) {
    apiError(res, 404, "Organizer profile not found", "PROFILE_NOT_FOUND");
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizerId: profile.id, deletedAt: null },
  });

  if (!event) {
    apiError(res, 404, "Event not found", "EVENT_NOT_FOUND");
    return;
  }

  const interests = await prisma.sponsorInterest.findMany({
    where: { package: { eventId } },
    include: {
      package: { select: { id: true, title: true, priceInr: true } },
      sponsor: {
        include: {
          user: { select: { id: true, phone: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({ data: interests });
}
