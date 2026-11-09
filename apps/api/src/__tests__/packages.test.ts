import request from "supertest";
import jwt from "jsonwebtoken";

jest.mock("../lib/prisma", () => ({
  prisma: {
    organizerProfile: { findUnique: jest.fn() },
    event: { findFirst: jest.fn() },
    sponsorshipPackage: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("../lib/redis", () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
  },
}));

process.env["JWT_SECRET"] = "test-secret";
process.env["NODE_ENV"] = "test";

import { app } from "../app";
import { prisma } from "../lib/prisma";

const SECRET = "test-secret";
const organizerToken = jwt.sign(
  { userId: "user-org-1", role: "ORGANIZER", phone: "+919000000020" },
  SECRET,
  { expiresIn: "1h" },
);

const mockProfile = { id: "org-001", userId: "user-org-1" };
const mockEvent = {
  id: "evt-001",
  organizerId: "org-001",
  status: "DRAFT",
  deletedAt: null,
};
const mockPackage = {
  id: "pkg-001",
  eventId: "evt-001",
  title: "Gold Sponsor",
  description: "Prime logo placement and stage time",
  priceInr: 50000,
  perks: ["Stage banner", "MC mention"],
  availableSlots: 3,
};

describe("Packages Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.organizerProfile.findUnique as jest.Mock).mockResolvedValue(mockProfile);
    (prisma.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);
  });

  describe("POST /api/v1/events/:eventId/packages", () => {
    it("returns 401 without token", async () => {
      const res = await request(app)
        .post("/api/v1/events/evt-001/packages")
        .send({ title: "Gold" });
      expect(res.status).toBe(401);
    });

    it("creates a package", async () => {
      (prisma.sponsorshipPackage.create as jest.Mock).mockResolvedValue(mockPackage);

      const res = await request(app)
        .post("/api/v1/events/evt-001/packages")
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          title: "Gold Sponsor",
          description: "Prime logo placement and stage time",
          priceInr: 50000,
          perks: ["Stage banner", "MC mention"],
          availableSlots: 3,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe("Gold Sponsor");
    });

    it("returns 400 for invalid payload (missing perks)", async () => {
      const res = await request(app)
        .post("/api/v1/events/evt-001/packages")
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          title: "Gold Sponsor",
          description: "Prime logo placement and stage time",
          priceInr: 50000,
          availableSlots: 3,
        });

      expect(res.status).toBe(400);
    });

    it("returns 404 if event not found", async () => {
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/events/nonexistent/packages")
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({
          title: "Gold Sponsor",
          description: "Prime logo placement",
          priceInr: 50000,
          perks: ["Banner"],
          availableSlots: 1,
        });

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/v1/events/:eventId/packages/:id", () => {
    it("updates a package", async () => {
      (prisma.sponsorshipPackage.findFirst as jest.Mock).mockResolvedValue(mockPackage);
      (prisma.sponsorshipPackage.update as jest.Mock).mockResolvedValue({
        ...mockPackage,
        availableSlots: 5,
      });

      const res = await request(app)
        .put("/api/v1/events/evt-001/packages/pkg-001")
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({ availableSlots: 5 });

      expect(res.status).toBe(200);
      expect(res.body.data.availableSlots).toBe(5);
    });
  });

  describe("DELETE /api/v1/events/:eventId/packages/:id", () => {
    it("deletes a package", async () => {
      (prisma.sponsorshipPackage.findFirst as jest.Mock).mockResolvedValue(mockPackage);
      (prisma.sponsorshipPackage.delete as jest.Mock).mockResolvedValue(mockPackage);

      const res = await request(app)
        .delete("/api/v1/events/evt-001/packages/pkg-001")
        .set("Authorization", `Bearer ${organizerToken}`);

      expect(res.status).toBe(204);
    });
  });
});
