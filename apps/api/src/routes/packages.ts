import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/roleCheck";
import { validate } from "../middleware/validate";
import { createPackage, updatePackage, deletePackage } from "../controllers/packages.controller";

const router = Router({ mergeParams: true });

const CreatePackageSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(2000),
  priceInr: z.number().positive().max(10_000_000),
  perks: z.array(z.string().min(1).max(200)).min(1).max(20),
  availableSlots: z.number().int().min(1).max(1000),
});

const UpdatePackageSchema = CreatePackageSchema.partial();

router.use(authenticate, requireRole("ORGANIZER"));

router.post("/", validate(CreatePackageSchema), createPackage);
router.put("/:id", validate(UpdatePackageSchema), updatePackage);
router.delete("/:id", deletePackage);

export { router as packagesRouter };
