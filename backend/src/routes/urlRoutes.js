import express from "express";

import {
  getUrls,
  createUrl,
  updateUrl,
  deleteUrl
} from "../controllers/urlController.js";

import {
  protect
} from "../middleware/authMiddleware.js";

const router =
  express.Router();

router.get(
  "/",
  protect,
  getUrls
);

router.post(
  "/",
  protect,
  createUrl
);

router.patch(
  "/:id",
  protect,
  updateUrl
);

router.delete(
  "/:id",
  protect,
  deleteUrl
);

export default router;