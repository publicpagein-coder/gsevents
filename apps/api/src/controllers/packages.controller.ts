import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { cache } from "../lib/cache";
import { apiError } from "../lib/errors";

async function resolveOrganizerEvent(
  userId: string,
  eventId: string,
): Promise<{ profileId: string; eventExists: boolean }> {
  const profile = await prisma.organizerProfile.findUnique({ where: { userId } });
  if (!profile) return { profileId: "", eventExists: false };

  const event = await prisma.event.findFirst({
    where: { id: eventId, organizerId: profile.id, deletedAt: null },
  });

  return { profileId: profile.id, eventExists: !!event };
}

// POST /api/v1/events/:eventId/packages
export async function createPackage(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { eventId } = req.params as { eventId: string };

  const { eventExists } = await resolveOrganizerEvent(userId, eventId);
  if (!eventExists) {
    apiError(res, 404, "Event not found", "EVENT_NOT_FOUND");
    return;
  }

  const { title, description, priceInr, perks, availableSlots } = req.body as {
    title: string;
    description: string;
    priceInr: number;
    perks: string[];
    availableSlots: number;
  };

  const pkg = await prisma.sponsorshipPackage.create({
    data: { eventId, title, description, priceInr, perks, availableSlots },
  });

  await cache.invalidatePattern("events:list:*");

  res.status(201).json({ data: pkg });
}

// PUT /api/v1/events/:eventId/packages/:id
export async function updatePackage(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { eventId, id: packageId } = req.params as { eventId: string; id: string };

  const { eventExists } = await resolveOrganizerEvent(userId, eventId);
  if (!eventExists) {
    apiError(res, 404, "Event not found", "EVENT_NOT_FOUND");
    return;
  }

  const pkg = await prisma.sponsorshipPackage.findFirst({
    where: { id: packageId, eventId },
  });
  if (!pkg) {
    apiError(res, 404, "Package not found", "PACKAGE_NOT_FOUND");
    return;
  }

  const { title, description, priceInr, perks, availableSlots } = req.body as Partial<{
    title: string;
    description: string;
    priceInr: number;
    perks: string[];
    availableSlots: number;
  }>;

  const updated = await prisma.sponsorshipPackage.update({
    where: { id: packageId },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(priceInr !== undefined ? { priceInr } : {}),
      ...(perks !== undefined ? { perks } : {}),
      ...(availableSlots !== undefined ? { availableSlots } : {}),
    },
  });

  await cache.invalidatePattern("events:list:*");

  res.json({ data: updated });
}

// DELETE /api/v1/events/:eventId/packages/:id
export async function deletePackage(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { eventId, id: packageId } = req.params as { eventId: string; id: string };

  const { eventExists } = await resolveOrganizerEvent(userId, eventId);
  if (!eventExists) {
    apiError(res, 404, "Event not found", "EVENT_NOT_FOUND");
    return;
  }

  const pkg = await prisma.sponsorshipPackage.findFirst({
    where: { id: packageId, eventId },
  });
  if (!pkg) {
    apiError(res, 404, "Package not found", "PACKAGE_NOT_FOUND");
    return;
  }

  await prisma.sponsorshipPackage.delete({ where: { id: packageId } });

  await cache.invalidatePattern("events:list:*");

  res.status(204).send();
}
