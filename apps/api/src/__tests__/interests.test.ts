import request from "supertest";
import jwt from "jsonwebtoken";

jest.mock("../lib/prisma", () => ({
  prisma: {
    sponsorProfile: { findUnique: jest.fn() },
    sponsorshipPackage: { findUnique: jest.fn() },
    sponsorInterest: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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
const sponsorToken = jwt.sign(
  { userId: "user-spon-1", role: "SPONSOR", phone: "+919000000005" },
  SECRET,
  { expiresIn: "1h" },
);

const mockSponsorProfile = { id: "spon-001", userId: "user-spon-1" };

const mockPackage = {
  id: "pkg-001",
  eventId: "evt-001",
  event: { status: "LIVE", isPublic: true },
};

const mockInterest = {
  id: "int-001",
  sponsorId: "spon-001",
  packageId: "pkg-001",
  status: "INTERESTED",
  package: { id: "pkg-001", title: "Gold Sponsor", priceInr: 50000 },
};

describe("Interests Routes", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("POST /api/v1/interests", () => {
    it("returns 401 without token", async () => {
      const res = await request(app)
        .post("/api/v1/interests")
        .send({ packageId: "pkg-001" });
      expect(res.status).toBe(401);
    });

    it("returns 403 for non-sponsor", async () => {
      const token = jwt.sign(
        { userId: "user-1", role: "ORGANIZER", phone: "+919000000006" },
        SECRET,
        { expiresIn: "1h" },
      );
      const res = await request(app)
        .post("/api/v1/interests")
        .set("Authorization", `Bearer ${token}`)
        .send({ packageId: "pkg-001" });
      expect(res.status).toBe(403);
    });

    it("creates interest successfully", async () => {
      (prisma.sponsorProfile.findUnique as jest.Mock).mockResolvedValue(mockSponsorProfile);
      (prisma.sponsorshipPackage.findUnique as jest.Mock).mockResolvedValue(mockPackage);
      (prisma.sponsorInterest.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.sponsorInterest.create as jest.Mock).mockResolvedValue(mockInterest);

      const res = await request(app)
        .post("/api/v1/interests")
        .set("Authorization", `Bearer ${sponsorToken}`)
        .send({ packageId: "pkg-001" });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("INTERESTED");
    });

    it("returns 409 for duplicate interest", async () => {
      (prisma.sponsorProfile.findUnique as jest.Mock).mockResolvedValue(mockSponsorProfile);
      (prisma.sponsorshipPackage.findUnique as jest.Mock).mockResolvedValue(mockPackage);
      (prisma.sponsorInterest.findUnique as jest.Mock).mockResolvedValue(mockInterest);

      const res = await request(app)
        .post("/api/v1/interests")
        .set("Authorization", `Bearer ${sponsorToken}`)
        .send({ packageId: "pkg-001" });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("ALREADY_INTERESTED");
    });

    it("returns 404 if package event is not LIVE", async () => {
      (prisma.sponsorProfile.findUnique as jest.Mock).mockResolvedValue(mockSponsorProfile);
      (prisma.sponsorshipPackage.findUnique as jest.Mock).mockResolvedValue({
        ...mockPackage,
        event: { status: "PENDING_APPROVAL", isPublic: true },
      });

      const res = await request(app)
        .post("/api/v1/interests")
        .set("Authorization", `Bearer ${sponsorToken}`)
        .send({ packageId: "pkg-001" });

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/v1/interests/:id", () => {
    it("transitions from INTERESTED to CONTACTED", async () => {
      (prisma.sponsorProfile.findUnique as jest.Mock).mockResolvedValue(mockSponsorProfile);
      (prisma.sponsorInterest.findFirst as jest.Mock).mockResolvedValue(mockInterest);
      (prisma.sponsorInterest.update as jest.Mock).mockResolvedValue({
        ...mockInterest,
        status: "CONTACTED",
      });

      const res = await request(app)
        .put("/api/v1/interests/int-001")
        .set("Authorization", `Bearer ${sponsorToken}`)
        .send({ status: "CONTACTED" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("CONTACTED");
    });

    it("rejects invalid status transition", async () => {
      (prisma.sponsorProfile.findUnique as jest.Mock).mockResolvedValue(mockSponsorProfile);
      (prisma.sponsorInterest.findFirst as jest.Mock).mockResolvedValue(mockInterest);

      const res = await request(app)
        .put("/api/v1/interests/int-001")
        .set("Authorization", `Bearer ${sponsorToken}`)
        .send({ status: "DEAL_DONE" }); // Can't jump from INTERESTED to DEAL_DONE

      expect(res.status).toBe(422);
      expect(res.body.code).toBe("INVALID_STATUS_TRANSITION");
    });
  });

  describe("GET /api/v1/interests/:id/contact", () => {
    it("returns organizer contact when interest exists", async () => {
      (prisma.sponsorProfile.findUnique as jest.Mock).mockResolvedValue(mockSponsorProfile);
      (prisma.sponsorInterest.findFirst as jest.Mock).mockResolvedValue({
        ...mockInterest,
        status: "CONTACTED",
        package: {
          event: {
            organizer: {
              orgName: "Test Org",
              user: { id: "usr-1", phone: "+919999999999", name: "Organizer Name" },
            },
          },
        },
      });
      (prisma.sponsorInterest.update as jest.Mock).mockResolvedValue({});

      const res = await request(app)
        .get("/api/v1/interests/int-001/contact")
        .set("Authorization", `Bearer ${sponsorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.phone).toBeDefined();
    });

    it("returns 404 for non-existent interest", async () => {
      (prisma.sponsorProfile.findUnique as jest.Mock).mockResolvedValue(mockSponsorProfile);
      (prisma.sponsorInterest.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/interests/nonexistent/contact")
        .set("Authorization", `Bearer ${sponsorToken}`);

      expect(res.status).toBe(404);
    });
  });
});
