import type { Router } from "express";
import { Router as ExpressRouter } from "express";

const router: Router = ExpressRouter();

// Health check
router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Route groups — to be implemented in subsequent tasks
// router.use("/auth", authRouter);
// router.use("/events", eventsRouter);
// router.use("/sponsors", sponsorsRouter);
// router.use("/organizers", organizersRouter);
// router.use("/packages", packagesRouter);
// router.use("/chat", chatRouter);
// router.use("/admin", adminRouter);

export { router };
