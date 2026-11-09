import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { cache } from "../lib/cache";
import { apiError } from "../lib/errors";
import type { EventStatus } from "@prisma/client";

const EVENTS_CACHE_TTL = 300; // 5 minutes

function buildCacheKey(params: Record<string, string | undefined>): string {
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return `events:list:${sorted}`;
}

// POST /api/v1/events
export async function createEvent(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const profile = await prisma.organizerProfile.findUnique({ where: { userId } });
  if (!profile) {
    apiError(res, 403, "Organizer profile required to create events", "PROFILE_REQUIRED");
    return;
  }

  const {
    title,
    description,
    city,
    state,
    startDate,
    endDate,
    category,
    isPublic,
    ticketOption,
    ticketPrice,
    maxSeats,
  } = req.body as {
    title: string;
    description: string;
    city: string;
    state: string;
    startDate: string;
    endDate: string;
    category: string;
    isPublic?: boolean;
    ticketOption?: "NONE" | "FREE" | "PAID";
    ticketPrice?: number;
    maxSeats?: number;
  };

  const event = await prisma.event.create({
    data: {
      organizerId: profile.id,
      title,
      description,
      city,
      state,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      category,
      isPublic: isPublic ?? true,
      ticketOption: ticketOption ?? "NONE",
      ticketPrice: ticketPrice ?? null,
      maxSeats: maxSeats ?? null,
      status: "PENDING_APPROVAL",
    },
    include: { sponsorshipPackages: true },
  });

  // Invalidate events list cache
  await cache.invalidatePattern("events:list:*");

  res.status(201).json({ data: event });
}

// GET /api/v1/events
export async function listEvents(req: Request, res: Response): Promise<void> {
  const { cursor, limit, city, state, category, dateFrom, dateTo, search, status } =
    req.query as Record<string, string | undefined>;

  const take = Math.min(parseInt(limit ?? "20", 10) || 20, 100);
  const userRole = req.user?.role;
  const userId = req.user?.userId;

  // Determine visible statuses by role
  let allowedStatuses: EventStatus[];
  if (userRole === "ADMIN") {
    allowedStatuses = status
      ? [status as EventStatus]
      : ["DRAFT", "PENDING_APPROVAL", "LIVE", "CANCELLED"];
  } else if (userRole === "ORGANIZER") {
    allowedStatuses = status ? [status as EventStatus] : ["DRAFT", "PENDING_APPROVAL", "LIVE", "CANCELLED"];
  } else {
    // General user / sponsor / unauthenticated — only LIVE
    allowedStatuses = ["LIVE"];
  }

  // Organizers see only their own events (unless admin)
  let organizerFilter: { organizerId: string } | undefined;
  if (userRole === "ORGANIZER" && userId) {
    const profile = await prisma.organizerProfile.findUnique({ where: { userId } });
    if (profile) organizerFilter = { organizerId: profile.id };
  }

  const cacheKey = buildCacheKey({
    cursor,
    limit: String(take),
    city,
    state,
    category,
    dateFrom,
    dateTo,
    search,
    status: allowedStatuses.join(","),
    ...(organizerFilter ? { org: organizerFilter.organizerId } : {}),
  });

  // Only cache public/general requests (not organizer-specific)
  const useCache = !organizerFilter && userRole !== "ADMIN";
  if (useCache) {
    const cached = await cache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }
  }

  const where = {
    deletedAt: null,
    status: { in: allowedStatuses },
    ...(organizerFilter ?? {}),
    ...(userRole === "ADMIN" || userRole === "ORGANIZER" ? {} : { isPublic: true }),
    ...(city ? { city: { contains: city, mode: "insensitive" as const } } : {}),
    ...(state ? { state } : {}),
    ...(category ? { category } : {}),
    ...(dateFrom ? { startDate: { gte: new Date(dateFrom) } } : {}),
    ...(dateTo ? { startDate: { lte: new Date(dateTo) } } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
            { city: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const events = await prisma.event.findMany({
    where,
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      sponsorshipPackages: true,
      organizer: { select: { id: true, orgName: true, verificationStatus: true } },
    },
  });

  const hasMore = events.length > take;
  const items = hasMore ? events.slice(0, take) : events;

  const response = {
    data: items,
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
    hasMore,
  };

  if (useCache) {
    await cache.set(cacheKey, response, EVENTS_CACHE_TTL);
  }

  res.json(response);
}

// GET /api/v1/events/:id
export async function getEvent(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const userRole = req.user?.role;

  const event = await prisma.event.findFirst({
    where: {
      id,
      deletedAt: null,
      // Non-admin/organizer can only see LIVE events
      ...(userRole !== "ADMIN" && userRole !== "ORGANIZER" ? { status: "LIVE", isPublic: true } : {}),
    },
    include: {
      sponsorshipPackages: true,
      organizer: { select: { id: true, orgName: true, venueName: true, verificationStatus: true } },
    },
  });

  if (!event) {
    apiError(res, 404, "Event not found", "EVENT_NOT_FOUND");
    return;
  }

  res.json({ data: event });
}

// PUT /api/v1/events/:id
export async function updateEvent(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id } = req.params as { id: string };

  const profile = await prisma.organizerProfile.findUnique({ where: { userId } });
  if (!profile) {
    apiError(res, 403, "Organizer profile required", "PROFILE_REQUIRED");
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id, organizerId: profile.id, deletedAt: null },
  });

  if (!event) {
    apiError(res, 404, "Event not found", "EVENT_NOT_FOUND");
    return;
  }

  if (event.status !== "DRAFT" && event.status !== "REJECTED") {
    apiError(
      res,
      403,
      "Only DRAFT or REJECTED events can be updated",
      "EVENT_NOT_EDITABLE",
    );
    return;
  }

  const {
    title,
    description,
    city,
    state,
    startDate,
    endDate,
    category,
    isPublic,
    ticketOption,
    ticketPrice,
    maxSeats,
    status,
  } = req.body as Partial<{
    title: string;
    description: string;
    city: string;
    state: string;
    startDate: string;
    endDate: string;
    category: string;
    isPublic: boolean;
    ticketOption: "NONE" | "FREE" | "PAID";
    ticketPrice: number;
    maxSeats: number;
    status: "DRAFT" | "PENDING_APPROVAL";
  }>;

  const updated = await prisma.event.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(city !== undefined ? { city } : {}),
      ...(state !== undefined ? { state } : {}),
      ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
      ...(endDate !== undefined ? { endDate: new Date(endDate) } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(isPublic !== undefined ? { isPublic } : {}),
      ...(ticketOption !== undefined ? { ticketOption } : {}),
      ...(ticketPrice !== undefined ? { ticketPrice } : {}),
      ...(maxSeats !== undefined ? { maxSeats } : {}),
      ...(status !== undefined ? { status, rejectionReason: null } : {}),
    },
    include: { sponsorshipPackages: true },
  });

  await cache.invalidatePattern("events:list:*");

  res.json({ data: updated });
}

// DELETE /api/v1/events/:id
export async function deleteEvent(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id } = req.params as { id: string };

  const profile = await prisma.organizerProfile.findUnique({ where: { userId } });
  if (!profile) {
    apiError(res, 403, "Organizer profile required", "PROFILE_REQUIRED");
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id, organizerId: profile.id, deletedAt: null },
  });

  if (!event) {
    apiError(res, 404, "Event not found", "EVENT_NOT_FOUND");
    return;
  }

  await prisma.event.update({ where: { id }, data: { deletedAt: new Date() } });

  await cache.invalidatePattern("events:list:*");

  res.status(204).send();
}
