import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/roleCheck";
import { validate } from "../middleware/validate";
import {
  upsertOrganizerProfile,
  getOrganizerProfile,
  getOrganizerEvents,
  getEventInterests,
} from "../controllers/organizer.controller";

const router = Router();

const OrganizerProfileSchema = z.object({
  orgName: z.string().min(2).max(200),
  societyName: z.string().min(2).max(200).optional(),
  venueName: z.string().min(2).max(200).optional(),
  socialLink: z.string().url().optional(),
});

router.use(authenticate);

router.post("/profile", requireRole("ORGANIZER", "ADMIN"), validate(OrganizerProfileSchema), upsertOrganizerProfile);
router.get("/profile", requireRole("ORGANIZER", "ADMIN"), getOrganizerProfile);
router.get("/events", requireRole("ORGANIZER", "ADMIN"), getOrganizerEvents);
router.get("/events/:id/interests", requireRole("ORGANIZER", "ADMIN"), getEventInterests);

export { router as organizerRouter };
