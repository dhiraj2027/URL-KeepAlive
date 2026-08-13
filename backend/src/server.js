import 'dotenv/config';

import app from "./app.js";
import connectDB from "./config/db.js";
import { startScheduler } from "./scheduler/keepAlive.js";


const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
      startScheduler(); // scheduler starts after DB is ready
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

startServer();