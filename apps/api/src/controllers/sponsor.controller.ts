import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { apiError } from "../lib/errors";

// POST /api/v1/sponsor/profile
export async function upsertSponsorProfile(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { companyName } = req.body as { companyName: string };

  const existing = await prisma.sponsorProfile.findUnique({ where: { userId } });

  if (existing) {
    const profile = await prisma.sponsorProfile.update({
      where: { userId },
      data: { companyName },
    });
    res.json({ data: profile });
  } else {
    await prisma.user.update({ where: { id: userId }, data: { role: "SPONSOR" } });
    const profile = await prisma.sponsorProfile.create({
      data: { userId, companyName, subscriptionPlan: "BASIC" },
    });
    res.status(201).json({ data: profile });
  }
}

// GET /api/v1/sponsor/profile
export async function getSponsorProfile(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const profile = await prisma.sponsorProfile.findUnique({
    where: { userId },
    include: { user: { select: { id: true, phone: true, name: true, role: true } } },
  });

  if (!profile) {
    apiError(res, 404, "Sponsor profile not found", "PROFILE_NOT_FOUND");
    return;
  }

  res.json({ data: profile });
}

// GET /api/v1/sponsor/interests
export async function getSponsorInterests(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { cursor, limit = "20", status } = req.query as {
    cursor?: string;
    limit?: string;
    status?: string;
  };

  const take = Math.min(parseInt(limit, 10) || 20, 100);

  const profile = await prisma.sponsorProfile.findUnique({ where: { userId } });
  if (!profile) {
    apiError(res, 404, "Sponsor profile not found", "PROFILE_NOT_FOUND");
    return;
  }

  const interests = await prisma.sponsorInterest.findMany({
    where: {
      sponsorId: profile.id,
      ...(status ? { status: status as never } : {}),
    },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      package: {
        include: {
          event: {
            select: {
              id: true,
              title: true,
              city: true,
              state: true,
              startDate: true,
              endDate: true,
              status: true,
            },
          },
        },
      },
    },
  });

  const hasMore = interests.length > take;
  const items = hasMore ? interests.slice(0, take) : interests;

  res.json({
    data: items,
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
    hasMore,
  });
}
