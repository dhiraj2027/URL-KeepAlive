import cron from "node-cron";
import Url from "../models/Url.js";

const TIMEOUT_MS = 15_000;        // 15-second per-request timeout
const INTERVAL_MIN = 12;          // Render free tier sleeps after 15 min of inactivity

let cycleRunning = false;

/**
 * Ping a single URL document and write the result straight to MongoDB.
 * No HTTP round-trip to internal endpoints — same process, same DB connection.
 */
async function pingOne(urlDoc) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(urlDoc.url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: { 
        "User-Agent": "RenderKeepAlive/1.0" 
      },
    });

    urlDoc.lastStatus = res.ok ? "healthy" : "failed";
    urlDoc.lastStatusCode = res.status;
    urlDoc.lastError = res.ok
      ? null
      : `HTTP ${res.status} ${res.statusText}`.trim();

    console.log(
      `[KeepAlive] ${res.ok ? "✓" : "✗"} ${urlDoc.url} → ${res.status}`
    );
  } catch (err) {
    urlDoc.lastStatus = "failed"; 
    urlDoc.lastStatusCode = null;

    urlDoc.lastError =
      err.name === "AbortError" 
        ? `Timed out after ${TIMEOUT_MS / 1000}s` 
        : err.message;
        
    console.error(`[KeepAlive] ✗  ${urlDoc.url}  →  ${urlDoc.lastError}`);
  } finally {
    // Always clear the abort timer, and always persist the result.
    clearTimeout(timer);

    urlDoc.lastPingAt = new Date();

    try {
      await urlDoc.save();
    } catch (err) {
      console.error(
        `[KeepAlive] DB save failed for ${urlDoc.url}:`,
        err.message
      );
    }
  }
}

/**
 * One full scheduler cycle: load all enabled URLs and ping them concurrently.
 * Promise.allSettled ensures one failure does not abort the others.
 */
async function runCycle() {
  // Re-entrancy guard — skip this tick if the previous cycle is still running.
  if (cycleRunning) {
    console.warn("[KeepAlive] Previous cycle still running — skipping tick.");
    return;
  }

  cycleRunning = true;

  try {
    const urls = await Url.find({ enabled: true });

    if (!urls.length) {
      console.log("[KeepAlive] No enabled URLs to ping.");
      return;
    }

    console.log(`[KeepAlive] Pinging ${urls.length} URL(s)…`);

    const results = await Promise.allSettled(
      urls.map((url) => pingOne(url))
    );

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(
          `[KeepAlive] Unexpected error for ${urls[index].url}:`,
          result.reason
        );
      }
    });

    console.log("[KeepAlive] Cycle complete.");
  } catch (err) {
    console.error("[KeepAlive] Cycle error:", err.message);
  } finally {
    // Always release the guard so the next tick can run.
    cycleRunning = false;
  }
}

/**
 * Register the cron schedule.  Called once from server.js after DB connects.
 */
export function startScheduler() {
  // Immediate first cycle — don't wait for the first cron tick
  runCycle().catch((err) =>
    console.error("[KeepAlive] Initial cycle error:", err)
  );

  // Recurring schedule
  cron.schedule(`*/${INTERVAL_MIN} * * * *`, () => {
    runCycle().catch((err) =>
      console.error("[KeepAlive] Unhandled cycle error:", err)
    );
  });

  console.log(
    `[KeepAlive] Scheduler started — immediate first ping, then every ${INTERVAL_MIN} min.`
  );
}