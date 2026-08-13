import "dotenv/config";

import app from "./app.js";
import connectDB from "./config/db.js";
import {
  startScheduler
} from "./scheduler/keepAlive.js";

const PORT =
  Number(process.env.PORT) ||
  5000;

const now = () =>
  new Date().toISOString();

const validateEnvironment =
  () => {
    const required = [
      "MONGODB_URI",
      "JWT_SECRET"
    ];

    const missing =
      required.filter(
        (key) =>
          !process.env[key]
      );

    if (
      missing.length
    ) {
      throw new Error(
        `Missing environment variables: ${missing.join(
          ", "
        )}`
      );
    }
  };

const startServer =
  async () => {
    const startupStartedAt =
      Date.now();

    try {
      console.log(
        `[Server] [${now()}] Starting server...`
      );

      validateEnvironment();

      console.log(
        `[Server] [${now()}] Connecting to MongoDB...`
      );

      await connectDB();

      console.log(
        `[Server] [${now()}] MongoDB connection ready after ${
          Date.now() -
          startupStartedAt
        }ms`
      );

      app.listen(
        PORT,
        "0.0.0.0",
        () => {
          console.log(
            `[Server] [${now()}] Server running on port ${PORT} | startupTime=${
              Date.now() -
              startupStartedAt
            }ms`
          );

          startScheduler();
        }
      );
    } catch (error) {
      console.error(
        `[Server] [${now()}] Server startup failed after ${
          Date.now() -
          startupStartedAt
        }ms:`,
        error
      );

      process.exit(1);
    }
  };

startServer();