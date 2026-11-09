import { Router } from "express";
import { authRouter } from "./auth";
import { organizerRouter } from "./organizer";
import { sponsorRouter } from "./sponsor";
import { eventsRouter } from "./events";
import { packagesRouter } from "./packages";
import { interestsRouter } from "./interests";
import { adminRouter } from "./admin";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.use("/auth", authRouter);
router.use("/organizer", organizerRouter);
router.use("/sponsor", sponsorRouter);
router.use("/events", eventsRouter);
router.use("/events/:eventId/packages", packagesRouter);
router.use("/interests", interestsRouter);
router.use("/admin", adminRouter);

export { router };
