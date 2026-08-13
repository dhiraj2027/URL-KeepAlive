import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import urlRoutes from "./routes/urlRoutes.js";

const app =
  express();

const allowedOrigin =
  process.env.FRONTEND_URL ||
  "http://localhost:5173";

app.use(
  cors({
    origin: allowedOrigin,
    methods: [
      "GET",
      "POST",
      "PATCH",
      "DELETE",
      "OPTIONS"
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ],
    credentials: false
  })
);

app.use(
  express.json({
    limit: "100kb"
  })
);

app.disable("x-powered-by");

/*
 * Cheap health endpoint.
 *
 * Your external monitor can ping this route
 * after deployment to keep the web service active.
 *
 * Do NOT perform MongoDB queries or monitored URL
 * pings here.
 */
app.get(
  "/health",
  (req, res) => {
    return res.status(200).json({
      success: true,
      status: "healthy",
      service:
        "url-keepalive-backend",
      timestamp:
        new Date().toISOString()
    });
  }
);

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/urls",
  urlRoutes
);

app.use(
  (req, res) => {
    return res.status(404).json({
      success: false,
      message:
        "Route not found"
    });
  }
);

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "[Express] Unhandled error:",
      error
    );

    if (
      res.headersSent
    ) {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      message:
        "Internal server error"
    });
  }
);

export default app;