import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/roleCheck";
import { validate } from "../middleware/validate";
import {
  createEvent,
  listEvents,
  getEvent,
  updateEvent,
  deleteEvent,
} from "../controllers/events.controller";
import { EVENT_CATEGORIES, INDIAN_STATES } from "@gsevents/shared";

const router = Router();

// Base shape without the date cross-field check so we can reuse it for UpdateEventSchema
const EventBaseShape = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(5000),
  city: z.string().min(2).max(100),
  state: z.enum(INDIAN_STATES),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  category: z.enum(EVENT_CATEGORIES),
  isPublic: z.boolean().default(true),
  ticketOption: z.enum(["NONE", "FREE", "PAID"] as const).default("NONE"),
  ticketPrice: z.number().positive().optional(),
  maxSeats: z.number().int().positive().optional(),
});

const CreateEventSchema = EventBaseShape.refine(
  (d) => new Date(d.startDate) < new Date(d.endDate),
  { message: "startDate must be before endDate", path: ["endDate"] },
);

const UpdateEventSchema = EventBaseShape.partial()
  .extend({
    status: z.enum(["DRAFT", "PENDING_APPROVAL"]).optional(),
  })
  .refine(
    (d) => {
      if (d.startDate && d.endDate) {
        return new Date(d.startDate) < new Date(d.endDate);
      }
      return true;
    },
    { message: "startDate must be before endDate", path: ["endDate"] },
  );

// Public browse — no auth required
router.get("/", listEvents);
router.get("/:id", getEvent);

// Auth-required routes
router.post("/", authenticate, requireRole("ORGANIZER"), validate(CreateEventSchema), createEvent);
router.put("/:id", authenticate, requireRole("ORGANIZER"), validate(UpdateEventSchema), updateEvent);
router.delete("/:id", authenticate, requireRole("ORGANIZER"), deleteEvent);

export { router as eventsRouter };
