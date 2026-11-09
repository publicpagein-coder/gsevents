import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/roleCheck";
import { validate } from "../middleware/validate";
import {
  upsertSponsorProfile,
  getSponsorProfile,
  getSponsorInterests,
} from "../controllers/sponsor.controller";

const router = Router();

const SponsorProfileSchema = z.object({
  companyName: z.string().min(2).max(200),
});

router.use(authenticate);

router.post("/profile", requireRole("SPONSOR", "ADMIN"), validate(SponsorProfileSchema), upsertSponsorProfile);
router.get("/profile", requireRole("SPONSOR", "ADMIN"), getSponsorProfile);
router.get("/interests", requireRole("SPONSOR", "ADMIN"), getSponsorInterests);

export { router as sponsorRouter };
