import request from "supertest";
import jwt from "jsonwebtoken";

jest.mock("../lib/prisma", () => ({
  prisma: {
    user: { update: jest.fn() },
    organizerProfile: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    event: { findMany: jest.fn(), findFirst: jest.fn() },
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
const organizerToken = jwt.sign(
  { userId: "user-org-1", role: "ORGANIZER", phone: "+919000000002" },
  SECRET,
  { expiresIn: "1h" },
);

const mockProfile = {
  id: "org-001",
  userId: "user-org-1",
  orgName: "Test Society",
  societyName: "Gandhi Nagar Society",
  venueName: null,
  socialLink: null,
  verificationStatus: "PENDING",
  adminNotes: null,
  user: { id: "user-org-1", phone: "+919000000002", name: null, role: "ORGANIZER" },
};

describe("Organizer Routes", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("POST /api/v1/organizer/profile", () => {
    it("returns 401 without token", async () => {
      const res = await request(app).post("/api/v1/organizer/profile").send({ orgName: "Test" });
      expect(res.status).toBe(401);
    });

    it("creates profile when none exists", async () => {
      (prisma.organizerProfile.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.update as jest.Mock).mockResolvedValue({});
      (prisma.organizerProfile.create as jest.Mock).mockResolvedValue(mockProfile);

      const res = await request(app)
        .post("/api/v1/organizer/profile")
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({ orgName: "Test Society", societyName: "Gandhi Nagar Society" });

      expect(res.status).toBe(201);
      expect(res.body.data.orgName).toBe("Test Society");
    });

    it("updates existing profile", async () => {
      (prisma.organizerProfile.findUnique as jest.Mock).mockResolvedValue(mockProfile);
      (prisma.organizerProfile.update as jest.Mock).mockResolvedValue({
        ...mockProfile,
        orgName: "Updated Org",
      });

      const res = await request(app)
        .post("/api/v1/organizer/profile")
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({ orgName: "Updated Org" });

      expect(res.status).toBe(200);
      expect(res.body.data.orgName).toBe("Updated Org");
    });

    it("returns 400 for short orgName", async () => {
      const res = await request(app)
        .post("/api/v1/organizer/profile")
        .set("Authorization", `Bearer ${organizerToken}`)
        .send({ orgName: "X" });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/organizer/profile", () => {
    it("returns profile", async () => {
      (prisma.organizerProfile.findUnique as jest.Mock).mockResolvedValue(mockProfile);

      const res = await request(app)
        .get("/api/v1/organizer/profile")
        .set("Authorization", `Bearer ${organizerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe("org-001");
    });

    it("returns 404 when profile not found", async () => {
      (prisma.organizerProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/organizer/profile")
        .set("Authorization", `Bearer ${organizerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("PROFILE_NOT_FOUND");
    });
  });

  describe("GET /api/v1/organizer/events", () => {
    it("returns organizer events", async () => {
      (prisma.organizerProfile.findUnique as jest.Mock).mockResolvedValue(mockProfile);
      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/organizer/events")
        .set("Authorization", `Bearer ${organizerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe("GET /api/v1/organizer/events/:id/interests", () => {
    it("returns interests for a specific event", async () => {
      (prisma.organizerProfile.findUnique as jest.Mock).mockResolvedValue(mockProfile);
      (prisma.event.findFirst as jest.Mock).mockResolvedValue({ id: "evt-1" });
      (prisma.sponsorInterest.findMany as jest.Mock).mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/organizer/events/evt-1/interests")
        .set("Authorization", `Bearer ${organizerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it("returns 404 if event not found", async () => {
      (prisma.organizerProfile.findUnique as jest.Mock).mockResolvedValue(mockProfile);
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/organizer/events/nonexistent/interests")
        .set("Authorization", `Bearer ${organizerToken}`);

      expect(res.status).toBe(404);
    });
  });
});
