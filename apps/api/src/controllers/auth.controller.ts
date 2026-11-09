import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { apiError } from "../lib/errors";
import {
  generateOtp,
  storeOtp,
  verifyStoredOtp,
  generateAccessToken,
  generateRefreshToken,
  consumeRefreshToken,
  MOCK_OTP,
} from "../services/auth.service";
import { sendOtpViaMSG91 } from "../services/msg91.service";
import type { Role } from "@prisma/client";

// POST /api/v1/auth/send-otp
export async function sendOtp(req: Request, res: Response): Promise<void> {
  const { phone } = req.body as { phone: string };

  const isMock = !process.env["MSG91_AUTH_KEY"];
  const otp = isMock ? MOCK_OTP : generateOtp();

  await storeOtp(phone, otp);

  if (!isMock) {
    try {
      await sendOtpViaMSG91(phone, otp);
    } catch (err) {
      console.error("[Auth] Failed to send OTP via MSG91:", err);
      apiError(res, 502, "Failed to send OTP. Please try again.", "OTP_SEND_FAILED");
      return;
    }
  }

  res.json({
    message: "OTP sent",
    ...(isMock && process.env["NODE_ENV"] !== "production" ? { _devOtp: MOCK_OTP } : {}),
  });
}

// POST /api/v1/auth/verify-otp  (also aliased as /login)
export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const { phone, otp, name, role } = req.body as {
    phone: string;
    otp: string;
    name?: string;
    role?: Role;
  };

  const isMock = !process.env["MSG91_AUTH_KEY"];
  const valid = isMock
    ? otp === MOCK_OTP
    : await verifyStoredOtp(phone, otp);

  if (!valid) {
    apiError(res, 401, "Invalid or expired OTP", "OTP_INVALID");
    return;
  }

  // Upsert user
  let user = await prisma.user.findUnique({ where: { phone } });
  const isNewUser = !user;

  if (!user) {
    user = await prisma.user.create({
      data: {
        phone,
        name: name ?? null,
        role: role ?? "GENERAL_USER",
      },
    });
  }

  const accessToken = generateAccessToken({
    userId: user.id,
    role: user.role,
    phone: user.phone,
  });
  const refreshToken = await generateRefreshToken(user.id);

  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, phone: user.phone, role: user.role, name: user.name },
    isNewUser,
  });
}

// POST /api/v1/auth/refresh
export async function refreshToken(req: Request, res: Response): Promise<void> {
  const { refreshToken: token } = req.body as { refreshToken?: string };

  if (!token) {
    apiError(res, 400, "refreshToken is required", "VALIDATION_ERROR");
    return;
  }

  const userId = await consumeRefreshToken(token);
  if (!userId) {
    apiError(res, 401, "Invalid or expired refresh token", "TOKEN_INVALID");
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    apiError(res, 401, "User not found", "USER_NOT_FOUND");
    return;
  }

  const accessToken = generateAccessToken({
    userId: user.id,
    role: user.role,
    phone: user.phone,
  });
  const newRefreshToken = await generateRefreshToken(user.id);

  res.json({ accessToken, refreshToken: newRefreshToken });
}

// GET /api/v1/auth/me
export async function getMe(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organizerProfile: true,
      sponsorProfile: true,
    },
  });

  if (!user) {
    apiError(res, 404, "User not found", "USER_NOT_FOUND");
    return;
  }

  res.json({ data: user });
}
