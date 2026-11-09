import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/roleCheck";
import { validate } from "../middleware/validate";
import {
  listOrganizers,
  verifyOrganizer,
  listAllEvents,
  approveEvent,
  rejectEvent,
  getAdminLogs,
} from "../controllers/admin.controller";

const router = Router();

const VerifyOrganizerSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  notes: z.string().max(1000).optional(),
});

const RejectEventSchema = z.object({
  reason: z.string().max(1000).optional(),
});

router.use(authenticate, requireRole("ADMIN"));

router.get("/organizers", listOrganizers);
router.put("/organizers/:id/verify", validate(VerifyOrganizerSchema), verifyOrganizer);

router.get("/events", listAllEvents);
router.put("/events/:id/approve", approveEvent);
router.put("/events/:id/reject", validate(RejectEventSchema), rejectEvent);

router.get("/logs", getAdminLogs);

export { router as adminRouter };
