import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { apiError } from "../lib/errors";
import type { InterestStatus } from "@prisma/client";

// POST /api/v1/interests
export async function createInterest(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { packageId } = req.body as { packageId: string };

  const profile = await prisma.sponsorProfile.findUnique({ where: { userId } });
  if (!profile) {
    apiError(res, 403, "Sponsor profile required to express interest", "PROFILE_REQUIRED");
    return;
  }

  // Ensure package exists and event is LIVE
  const pkg = await prisma.sponsorshipPackage.findUnique({
    where: { id: packageId },
    include: { event: { select: { status: true, isPublic: true } } },
  });

  if (!pkg || pkg.event.status !== "LIVE") {
    apiError(res, 404, "Package not found or event not live", "PACKAGE_NOT_FOUND");
    return;
  }

  const existing = await prisma.sponsorInterest.findUnique({
    where: { sponsorId_packageId: { sponsorId: profile.id, packageId } },
  });

  if (existing) {
    apiError(res, 409, "Interest already expressed for this package", "ALREADY_INTERESTED");
    return;
  }

  const interest = await prisma.sponsorInterest.create({
    data: { sponsorId: profile.id, packageId, status: "INTERESTED" },
    include: { package: { select: { id: true, title: true, priceInr: true } } },
  });

  res.status(201).json({ data: interest });
}

// PUT /api/v1/interests/:id
export async function updateInterest(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id } = req.params as { id: string };
  const { status } = req.body as { status: InterestStatus };

  const profile = await prisma.sponsorProfile.findUnique({ where: { userId } });
  if (!profile) {
    apiError(res, 403, "Sponsor profile required", "PROFILE_REQUIRED");
    return;
  }

  const interest = await prisma.sponsorInterest.findFirst({
    where: { id, sponsorId: profile.id },
  });

  if (!interest) {
    apiError(res, 404, "Interest not found", "INTEREST_NOT_FOUND");
    return;
  }

  const VALID_TRANSITIONS: Record<InterestStatus, InterestStatus[]> = {
    INTERESTED: ["CONTACTED"],
    CONTACTED: ["DEAL_DONE"],
    DEAL_DONE: [],
  };

  if (!VALID_TRANSITIONS[interest.status].includes(status)) {
    apiError(
      res,
      422,
      `Cannot transition from ${interest.status} to ${status}`,
      "INVALID_STATUS_TRANSITION",
    );
    return;
  }

  const updated = await prisma.sponsorInterest.update({
    where: { id },
    data: { status },
  });

  res.json({ data: updated });
}

// GET /api/v1/interests/:id/contact
export async function getContactDetails(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id } = req.params as { id: string };

  const profile = await prisma.sponsorProfile.findUnique({ where: { userId } });
  if (!profile) {
    apiError(res, 403, "Sponsor profile required", "PROFILE_REQUIRED");
    return;
  }

  const interest = await prisma.sponsorInterest.findFirst({
    where: { id, sponsorId: profile.id },
    include: {
      package: {
        include: {
          event: {
            include: {
              organizer: {
                include: {
                  user: { select: { id: true, phone: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!interest) {
    apiError(res, 404, "Interest not found", "INTEREST_NOT_FOUND");
    return;
  }

  if (interest.status === "INTERESTED") {
    // Allow contact on INTERESTED+ (move to CONTACTED automatically on first view)
  }

  // Log the contact share
  console.info(
    `[ContactShare] Sponsor ${profile.id} accessed organizer contact via interest ${id}`,
  );

  // Auto-advance to CONTACTED if still at INTERESTED
  if (interest.status === "INTERESTED") {
    await prisma.sponsorInterest.update({ where: { id }, data: { status: "CONTACTED" } });
  }

  const organizer = interest.package.event.organizer;

  res.json({
    data: {
      organizerName: organizer.orgName,
      phone: organizer.user.phone,
      name: organizer.user.name,
    },
  });
}
