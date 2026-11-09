import request from "supertest";
import jwt from "jsonwebtoken";

jest.mock("../lib/prisma", () => ({
  prisma: {
    user: { update: jest.fn() },
    sponsorProfile: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    sponsorInterest: { findMany: jest.fn() },
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
const sponsorToken = jwt.sign(
  { userId: "user-sponsor-1", role: "SPONSOR", phone: "+919000000003" },
  SECRET,
  { expiresIn: "1h" },
);

const mockSponsorProfile = {
  id: "spon-001",
  userId: "user-sponsor-1",
  companyName: "Acme Corp",
  subscriptionPlan: "BASIC",
  subscriptionExpiresAt: null,
  user: { id: "user-sponsor-1", phone: "+919000000003", name: null, role: "SPONSOR" },
};

describe("Sponsor Routes", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("POST /api/v1/sponsor/profile", () => {
    it("returns 401 without token", async () => {
      const res = await request(app)
        .post("/api/v1/sponsor/profile")
        .send({ companyName: "Acme" });
      expect(res.status).toBe(401);
    });

    it("creates sponsor profile", async () => {
      (prisma.sponsorProfile.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.update as jest.Mock).mockResolvedValue({});
      (prisma.sponsorProfile.create as jest.Mock).mockResolvedValue(mockSponsorProfile);

      const res = await request(app)
        .post("/api/v1/sponsor/profile")
        .set("Authorization", `Bearer ${sponsorToken}`)
        .send({ companyName: "Acme Corp" });

      expect(res.status).toBe(201);
      expect(res.body.data.companyName).toBe("Acme Corp");
    });

    it("updates existing profile", async () => {
      (prisma.sponsorProfile.findUnique as jest.Mock).mockResolvedValue(mockSponsorProfile);
      (prisma.sponsorProfile.update as jest.Mock).mockResolvedValue({
        ...mockSponsorProfile,
        companyName: "Updated Corp",
      });

      const res = await request(app)
        .post("/api/v1/sponsor/profile")
        .set("Authorization", `Bearer ${sponsorToken}`)
        .send({ companyName: "Updated Corp" });

      expect(res.status).toBe(200);
      expect(res.body.data.companyName).toBe("Updated Corp");
    });

    it("returns 400 for missing companyName", async () => {
      const res = await request(app)
        .post("/api/v1/sponsor/profile")
        .set("Authorization", `Bearer ${sponsorToken}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/sponsor/profile", () => {
    it("returns profile", async () => {
      (prisma.sponsorProfile.findUnique as jest.Mock).mockResolvedValue(mockSponsorProfile);

      const res = await request(app)
        .get("/api/v1/sponsor/profile")
        .set("Authorization", `Bearer ${sponsorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.companyName).toBe("Acme Corp");
    });

    it("returns 404 when profile not found", async () => {
      (prisma.sponsorProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/sponsor/profile")
        .set("Authorization", `Bearer ${sponsorToken}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("PROFILE_NOT_FOUND");
    });
  });

  describe("GET /api/v1/sponsor/interests", () => {
    it("returns list of interests", async () => {
      (prisma.sponsorProfile.findUnique as jest.Mock).mockResolvedValue(mockSponsorProfile);
      (prisma.sponsorInterest.findMany as jest.Mock).mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/sponsor/interests")
        .set("Authorization", `Bearer ${sponsorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it("returns 403 for non-sponsor", async () => {
      const otherToken = jwt.sign(
        { userId: "user-2", role: "ORGANIZER", phone: "+919000000004" },
        SECRET,
        { expiresIn: "1h" },
      );

      const res = await request(app)
        .get("/api/v1/sponsor/interests")
        .set("Authorization", `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });
  });
});
