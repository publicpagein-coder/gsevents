import request from "supertest";
import jwt from "jsonwebtoken";

jest.mock("../lib/prisma", () => ({
  prisma: {
    organizerProfile: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    event: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    adminLog: {
      create: jest.fn(),
      findMany: jest.fn(),
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
const adminToken = jwt.sign(
  { userId: "admin-user-1", role: "ADMIN", phone: "+919000000010" },
  SECRET,
  { expiresIn: "1h" },
);
const sponsorToken = jwt.sign(
  { userId: "user-2", role: "SPONSOR", phone: "+919000000011" },
  SECRET,
  { expiresIn: "1h" },
);

const mockOrganizerProfile = {
  id: "org-001",
  userId: "user-org-1",
  orgName: "Test Org",
  verificationStatus: "PENDING",
  adminNotes: null,
  user: { id: "user-org-1", phone: "+919111111111", name: null, createdAt: new Date() },
};

const mockEvent = {
  id: "evt-001",
  title: "Navratri 2027",
  status: "PENDING_APPROVAL",
  organizerId: "org-001",
  deletedAt: null,
  organizer: { id: "org-001", orgName: "Test Org", verificationStatus: "APPROVED" },
  sponsorshipPackages: [],
};

describe("Admin Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.adminLog.create as jest.Mock).mockResolvedValue({});
  });

  describe("Authorization", () => {
    it("returns 401 for unauthenticated requests", async () => {
      const res = await request(app).get("/api/v1/admin/organizers");
      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin users", async () => {
      const res = await request(app)
        .get("/api/v1/admin/organizers")
        .set("Authorization", `Bearer ${sponsorToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/v1/admin/organizers", () => {
    it("lists organizers", async () => {
      (prisma.organizerProfile.findMany as jest.Mock).mockResolvedValue([mockOrganizerProfile]);

      const res = await request(app)
        .get("/api/v1/admin/organizers")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it("filters by verificationStatus", async () => {
      (prisma.organizerProfile.findMany as jest.Mock).mockResolvedValue([]);

      const res = await request(app)
        .get("/api/v1/admin/organizers?verificationStatus=APPROVED")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(prisma.organizerProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { verificationStatus: "APPROVED" },
        }),
      );
    });
  });

  describe("PUT /api/v1/admin/organizers/:id/verify", () => {
    it("approves an organizer", async () => {
      (prisma.organizerProfile.findUnique as jest.Mock).mockResolvedValue(mockOrganizerProfile);
      (prisma.organizerProfile.update as jest.Mock).mockResolvedValue({
        ...mockOrganizerProfile,
        verificationStatus: "APPROVED",
      });

      const res = await request(app)
        .put("/api/v1/admin/organizers/org-001/verify")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "APPROVED" });

      expect(res.status).toBe(200);
      expect(res.body.data.verificationStatus).toBe("APPROVED");
      expect(prisma.adminLog.create).toHaveBeenCalled();
    });

    it("rejects an organizer with notes", async () => {
      (prisma.organizerProfile.findUnique as jest.Mock).mockResolvedValue(mockOrganizerProfile);
      (prisma.organizerProfile.update as jest.Mock).mockResolvedValue({
        ...mockOrganizerProfile,
        verificationStatus: "REJECTED",
        adminNotes: "Incomplete documents",
      });

      const res = await request(app)
        .put("/api/v1/admin/organizers/org-001/verify")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "REJECTED", notes: "Incomplete documents" });

      expect(res.status).toBe(200);
      expect(prisma.adminLog.create).toHaveBeenCalled();
    });

    it("returns 400 for invalid status value", async () => {
      const res = await request(app)
        .put("/api/v1/admin/organizers/org-001/verify")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "INVALID_STATUS" });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/admin/events", () => {
    it("lists all events", async () => {
      (prisma.event.findMany as jest.Mock).mockResolvedValue([mockEvent]);

      const res = await request(app)
        .get("/api/v1/admin/events")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe("PUT /api/v1/admin/events/:id/approve", () => {
    it("approves a PENDING_APPROVAL event", async () => {
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.event.update as jest.Mock).mockResolvedValue({ ...mockEvent, status: "LIVE" });
      (prisma.adminLog.create as jest.Mock).mockResolvedValue({});

      const res = await request(app)
        .put("/api/v1/admin/events/evt-001/approve")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("LIVE");
      expect(prisma.adminLog.create).toHaveBeenCalled();
    });

    it("returns 422 if event is already LIVE", async () => {
      (prisma.event.findFirst as jest.Mock).mockResolvedValue({ ...mockEvent, status: "LIVE" });

      const res = await request(app)
        .put("/api/v1/admin/events/evt-001/approve")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(422);
      expect(res.body.code).toBe("INVALID_STATUS");
    });
  });

  describe("PUT /api/v1/admin/events/:id/reject", () => {
    it("rejects event with reason", async () => {
      (prisma.event.findFirst as jest.Mock).mockResolvedValue(mockEvent);
      (prisma.event.update as jest.Mock).mockResolvedValue({
        ...mockEvent,
        status: "REJECTED",
        rejectionReason: "Missing details",
      });

      const res = await request(app)
        .put("/api/v1/admin/events/evt-001/reject")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ reason: "Missing details" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("REJECTED");
      expect(prisma.adminLog.create).toHaveBeenCalled();
    });
  });

  describe("GET /api/v1/admin/logs", () => {
    it("returns admin audit logs", async () => {
      (prisma.adminLog.findMany as jest.Mock).mockResolvedValue([
        {
          id: "log-001",
          adminId: "admin-user-1",
          action: "APPROVE_EVENT",
          targetType: "Event",
          targetId: "evt-001",
          metadata: {},
          createdAt: new Date(),
          admin: { id: "admin-user-1", name: null, phone: "+919000000010" },
        },
      ]);

      const res = await request(app)
        .get("/api/v1/admin/logs")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].action).toBe("APPROVE_EVENT");
    });
  });
});
