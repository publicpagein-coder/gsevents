import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/roleCheck";
import { validate } from "../middleware/validate";
import {
  createInterest,
  updateInterest,
  getContactDetails,
} from "../controllers/interests.controller";

const router = Router();

const CreateInterestSchema = z.object({
  packageId: z.string().min(1, "packageId is required"),
});

const UpdateInterestSchema = z.object({
  status: z.enum(["INTERESTED", "CONTACTED", "DEAL_DONE"]),
});

router.use(authenticate);

router.post("/", requireRole("SPONSOR"), validate(CreateInterestSchema), createInterest);
router.put("/:id", requireRole("SPONSOR"), validate(UpdateInterestSchema), updateInterest);
router.get("/:id/contact", requireRole("SPONSOR"), getContactDetails);

export { router as interestsRouter };
