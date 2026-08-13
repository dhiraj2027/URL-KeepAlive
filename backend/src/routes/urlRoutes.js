import express from "express";

import {
  getUrls,
  createUrl,
  updateUrl,
  deleteUrl,
  getKeepAliveTargets,
  updatePingResult
} from "../controllers/urlController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// User-facing endpoints
router.get("/", protect, getUrls);
router.post("/", protect, createUrl);


/*
 * Internal scheduler endpoints BEFORE /:id param routes.
 * If they came after, a future GET /:id route would shadow GET /internal/targets.
 * Kept for external cron-job callers; the built-in scheduler uses the DB directly.
 */
router.get("/internal/targets", getKeepAliveTargets);
router.post("/internal/ping-result", updatePingResult);

// Param routes last
router.patch("/:id", protect, updateUrl);
router.delete("/:id", protect, deleteUrl);

export default router;