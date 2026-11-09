import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { otpRateLimiter } from "../middleware/rateLimiter";
import { sendOtp, verifyOtp, refreshToken, getMe } from "../controllers/auth.controller";

const router = Router();

const SendOtpSchema = z.object({
  phone: z
    .string()
    .regex(/^\+91[6-9]\d{9}$/, "Must be a valid Indian mobile number (+91XXXXXXXXXX)"),
});

const VerifyOtpSchema = z.object({
  phone: z
    .string()
    .regex(/^\+91[6-9]\d{9}$/, "Must be a valid Indian mobile number"),
  otp: z.string().length(6).regex(/^\d{6}$/, "OTP must be 6 digits"),
  name: z.string().min(2).max(100).optional(),
  role: z.enum(["ORGANIZER", "SPONSOR", "GENERAL_USER"]).optional(),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

router.post("/send-otp", otpRateLimiter, validate(SendOtpSchema), sendOtp);
router.post("/verify-otp", validate(VerifyOtpSchema), verifyOtp);
router.post("/login", validate(VerifyOtpSchema), verifyOtp); // alias
router.post("/refresh", validate(RefreshSchema), refreshToken);
router.get("/me", authenticate, getMe);

export { router as authRouter };
