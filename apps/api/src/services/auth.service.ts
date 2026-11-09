import crypto from "crypto";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../middleware/auth";
import { redis } from "../lib/redis";

const OTP_TTL_SECONDS = 300; // 5 min
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export const MOCK_OTP = "123456";

export function generateOtp(): string {
  // Cryptographically random 6-digit OTP
  const bytes = crypto.randomBytes(3);
  const num = (bytes.readUIntBE(0, 3) % 900000) + 100000;
  return num.toString();
}

function hashOtp(phone: string, otp: string): string {
  const secret = process.env["JWT_SECRET"] ?? "dev-secret";
  return crypto.createHmac("sha256", secret).update(`${phone}:${otp}`).digest("hex");
}

export async function storeOtp(phone: string, otp: string): Promise<void> {
  const hash = hashOtp(phone, otp);
  await redis.set(`otp:${phone}`, hash, "EX", OTP_TTL_SECONDS);
}

export async function verifyStoredOtp(phone: string, otp: string): Promise<boolean> {
  const stored = await redis.get(`otp:${phone}`);
  if (!stored || typeof stored !== "string") return false;

  const hash = hashOtp(phone, otp);
  const hashBuf = Buffer.from(hash, "hex");
  const storedBuf = Buffer.from(stored, "hex");

  // Guard: both must be valid hex digests of the same length
  if (hashBuf.length !== storedBuf.length || hashBuf.length === 0) return false;

  if (!crypto.timingSafeEqual(hashBuf, storedBuf)) return false;

  await redis.del(`otp:${phone}`);
  return true;
}

export function generateAccessToken(payload: JwtPayload): string {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("JWT_SECRET not configured");
  return jwt.sign(payload, secret, { expiresIn: ACCESS_TOKEN_TTL } as jwt.SignOptions);
}

export async function generateRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(40).toString("hex");
  await redis.set(`refresh:${token}`, userId, "EX", REFRESH_TOKEN_TTL_SECONDS);
  return token;
}

export async function consumeRefreshToken(token: string): Promise<string | null> {
  const userId = await redis.get(`refresh:${token}`);
  if (!userId) return null;
  // Rotate: delete old, caller will issue new
  await redis.del(`refresh:${token}`);
  return userId;
}
