import request from "supertest";
import jwt from "jsonwebtoken";

jest.mock("../lib/prisma", () => ({
  prisma: {
    event: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    organizerProfile: { findUnique: jest.fn() },
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
import { redis } from "../lib/redis";

const SECRET = "test-secret";

function makeToken(role: string, userId = "user-1") {
  return jwt.sign({ userId, role, phone: "+919000000001" }, SECRET, { expiresIn: "1h" });
}

const mockEvent = {
  id: "evt-001",
  organizerId: "org-001",
  title: "Navratri 2027 Grand Festival",
  description: "A grand Navratri festival in Ahmedabad with live garba performances",
  city: "Ahmedabad",
  state: "Gujarat",
  startDate: new Date("2027-10-01"),
  endDate: new Date("2027-10-10"),
  category: "NAVRATRI",
  isPublic: true,
  ticketOption: "NONE",
  ticketPrice: null,
  maxSeats: null,
  status: "LIVE",
  rejectionReason: null,
  deletedAt: null,
  createdAt: new Date(),
  sponsorshipPackages: [],
  organizer: { id: "org-001", orgName: "Test Org", verificationStatus: "APPROVED" },
};

const mockOrganizerProfile = {
  id: "org-001",
  userId: "user-1",
  orgName: "Test Org",
  verificationStatus: "APPROVED",
};

describe("Events Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (redis.get as jest.Mock).mockResolvedValue(null);
    (redis.set as jest.Mock).mockResolvedValue("OK");
    (redis.keys as jest.Mock).mockResolvedValue([]);
  });

  describe("GET /api/v1/events (public browse)", () => {
    it("returns list of LIVE events without auth", async () => {
      (prisma.event.findMany as jest.Mock).mockResolvedValue([mockEvent]);

      const res = await request(app).get("/api/v1/events");

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe("LIVE");
    });

    it("returns empty list when no events", async () => {
      (prisma.event.findMany as jest.Mock).mockResolvedValue([]);

      const res = await request(app).get("/api/v1/events");

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.hasMore).toBe(false);
    });

    it("supports cursor pagination via nextCursor", async () => {
      const events = Array.from({ length: 21 }, (_, i) => ({
        ...mockEvent,
        id: `evt-${i}`,
      }));
      (prisma.event.findMany as jest.Mock).mockResolvedValue(events);

      const res = await request(app).get("/api/v1/events?limit=20");

      expect(res.status).toBe(200);
      expect(res.body.hasMore).toBe(true);
      expect(res.body.nextCursor).toBe("evt-19");
    });

    it("serves cached response on second request", async () => {
      const cached = { data: [mockEvent], nextCursor: null, hasMore: false };
      (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(cached));

      const res = await request(app).get("/api/v1/events");

      expect(res.status).toBe(200);
      // Prisma should NOT be called since cache hit
      expect(prisma.event.findMany).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/v1/events/:id", () => {
    it("returns event details", async () => {
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);

      const res = await request(app).get("/api/v1/events/evt-001");

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe("evt-001");
    });

    it("returns 404 for non-existent event", async () => {
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get("/api/v1/events/nonexistent");

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("EVENT_NOT_FOUND");
    });
  });

  describe("POST /api/v1/events (organizer creates event)", () => {
    const validPayload = {
      title: "Navratri 2027 Grand Festival",
      description: "A grand Navratri festival in Ahmedabad with garba performances and food stalls",
      city: "Ahmedabad",
      state: "Gujarat",
      startDate: "2027-10-01T00:00:00.000Z",
      endDate: "2027-10-10T00:00:00.000Z",
      category: "NAVRATRI",
    };

    it("returns 401 without auth", async () => {
      const res = await request(app).post("/api/v1/events").send(validPayload);
      expect(res.status).toBe(401);
    });

    it("returns 403 for non-organizer", async () => {
      const token = makeToken("SPONSOR");
      const res = await request(app)
        .post("/api/v1/events")
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload);
      expect(res.status).toBe(403);
    });

    it("returns 403 when organizer has no profile", async () => {
      const token = makeToken("ORGANIZER");
      (prisma.organizerProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/events")
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("PROFILE_REQUIRED");
    });

    it("creates event with PENDING_APPROVAL status", async () => {
      const token = makeToken("ORGANIZER");
      (prisma.organizerProfile.findUnique as jest.Mock).mockResolvedValue(mockOrganizerProfile);
      (prisma.event.create as jest.Mock).mockResolvedValue({
        ...mockEvent,
        status: "PENDING_APPROVAL",
      });
      (redis.keys as jest.Mock).mockResolvedValue([]);

      const res = await request(app)
        .post("/api/v1/events")
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("PENDING_APPROVAL");
    });

    it("returns 400 if endDate is before startDate", async () => {
      const token = makeToken("ORGANIZER");
      const res = await request(app)
        .post("/api/v1/events")
        .set("Authorization", `Bearer ${token}`)
        .send({ ...validPayload, startDate: "2027-10-10T00:00:00.000Z", endDate: "2027-10-01T00:00:00.000Z" });

      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/v1/events/:id", () => {
    it("returns 403 if event is LIVE (not editable)", async () => {
      const token = makeToken("ORGANIZER");
      (prisma.organizerProfile.findUnique as jest.Mock).mockResolvedValue(mockOrganizerProfile);
      (prisma.event.findFirst as jest.Mock).mockResolvedValue({ ...mockEvent, status: "LIVE" });

      const res = await request(app)
        .put("/api/v1/events/evt-001")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Updated Title" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("EVENT_NOT_EDITABLE");
    });

    it("allows update when event is in DRAFT status", async () => {
      const token = makeToken("ORGANIZER");
      (prisma.organizerProfile.findUnique as jest.Mock).mockResolvedValue(mockOrganizerProfile);
      (prisma.event.findFirst as jest.Mock).mockResolvedValue({ ...mockEvent, status: "DRAFT" });
      (prisma.event.update as jest.Mock).mockResolvedValue({
        ...mockEvent,
        status: "DRAFT",
        title: "Updated",
      });
      (redis.keys as jest.Mock).mockResolvedValue([]);

      const res = await request(app)
        .put("/api/v1/events/evt-001")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Updated" });

      expect(res.status).toBe(200);
    });
  });

  describe("DELETE /api/v1/events/:id", () => {
    it("soft-deletes the event", async () => {
      const token = makeToken("ORGANIZER");
      (prisma.organizerProfile.findUnique as jest.Mock).mockResolvedValue(mockOrganizerProfile);
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.event.update as jest.Mock).mockResolvedValue({ ...mockEvent, deletedAt: new Date() });
      (redis.keys as jest.Mock).mockResolvedValue([]);

      const res = await request(app)
        .delete("/api/v1/events/evt-001")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(204);
    });
  });
});
