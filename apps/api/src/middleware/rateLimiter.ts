import rateLimit from "express-rate-limit";

/** 5 requests per minute per phone number (or IP as fallback). */
export const otpRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const phone = (req.body as { phone?: string }).phone;
    return phone ?? req.ip ?? "unknown";
  },
  handler: (_req, res) => {
    res.status(429).json({
      error: "Too many OTP requests. Please wait before trying again.",
      code: "RATE_LIMIT_EXCEEDED",
    });
  },
});
