import request from "supertest";
import jwt from "jsonwebtoken";

// Mock external dependencies before importing the app
jest.mock("../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    organizerProfile: { findUnique: jest.fn() },
    sponsorProfile: { findUnique: jest.fn() },
  },
}));

jest.mock("../lib/redis", () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
  },
}));

// MSG91 not configured → mock mode active
process.env["JWT_SECRET"] = "test-secret";
process.env["NODE_ENV"] = "test";

import { app } from "../app";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";

const mockUser = {
  id: "cltest123456789",
  phone: "+919876543210",
  role: "GENERAL_USER" as const,
  name: "Test User",
  createdAt: new Date(),
  organizerProfile: null,
  sponsorProfile: null,
};

describe("Auth Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/v1/auth/send-otp", () => {
    it("returns 400 for invalid phone number", async () => {
      const res = await request(app)
        .post("/api/v1/auth/send-otp")
        .send({ phone: "9876543210" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("returns 429 after rate limit exceeded", async () => {
      // Send 6 requests (limit is 5)
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post("/api/v1/auth/send-otp")
          .send({ phone: "+919999900001" });
      }
      const res = await request(app)
        .post("/api/v1/auth/send-otp")
        .send({ phone: "+919999900001" });

      expect(res.status).toBe(429);
      expect(res.body.code).toBe("RATE_LIMIT_EXCEEDED");
    });

    it("returns 200 and mock OTP hint in dev/test mode", async () => {
      (redis.set as jest.Mock).mockResolvedValue("OK");

      const res = await request(app)
        .post("/api/v1/auth/send-otp")
        .send({ phone: "+919000000001" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("OTP sent");
      expect(res.body._devOtp).toBe("123456");
    });
  });

  describe("POST /api/v1/auth/verify-otp", () => {
    it("returns 400 for missing OTP", async () => {
      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({ phone: "+919876543210" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("returns 401 for wrong OTP when MSG91 is configured", async () => {
      // Simulate MSG91 configured (so real OTP check is used)
      process.env["MSG91_AUTH_KEY"] = "fake-key";
      (redis.get as jest.Mock).mockResolvedValue(null); // no stored OTP

      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({ phone: "+919876543210", otp: "000000" });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("OTP_INVALID");

      // Properly remove — don't set to undefined string
      delete process.env["MSG91_AUTH_KEY"];
    });

    it("creates new user and returns tokens when OTP is correct (mock mode)", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      (redis.set as jest.Mock).mockResolvedValue("OK");

      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({
          phone: "+919876543210",
          otp: "123456",
          role: "GENERAL_USER",
          name: "Test User",
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        isNewUser: true,
      });
    });

    it("returns existing user when phone already registered (mock mode)", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (redis.set as jest.Mock).mockResolvedValue("OK");

      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({ phone: "+919876543210", otp: "123456" });

      expect(res.status).toBe(200);
      expect(res.body.isNewUser).toBe(false);
    });
  });

  describe("GET /api/v1/auth/me", () => {
    it("returns 401 without auth token", async () => {
      const res = await request(app).get("/api/v1/auth/me");
      expect(res.status).toBe(401);
    });

    it("returns 200 with valid token", async () => {
      const token = jwt.sign(
        { userId: mockUser.id, role: mockUser.role, phone: mockUser.phone },
        "test-secret",
        { expiresIn: "15m" },
      );

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(mockUser.id);
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    it("returns 400 for missing refreshToken", async () => {
      const res = await request(app).post("/api/v1/auth/refresh").send({});
      expect(res.status).toBe(400);
    });

    it("returns 401 for invalid refresh token", async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: "bad-token" });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("TOKEN_INVALID");
    });

    it("rotates refresh token successfully", async () => {
      (redis.get as jest.Mock).mockResolvedValue(mockUser.id);
      (redis.del as jest.Mock).mockResolvedValue(1);
      (redis.set as jest.Mock).mockResolvedValue("OK");
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: "valid-token-abc" });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });
  });

  describe("POST /api/v1/auth/login (alias for verify-otp)", () => {
    it("works the same as verify-otp", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (redis.set as jest.Mock).mockResolvedValue("OK");

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ phone: "+919876543210", otp: "123456" });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });
  });
});
