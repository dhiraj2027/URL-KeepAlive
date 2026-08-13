import Url from "../models/Url.js";

import {
  pingUrlById
} from "../services/urlPingService.js";

const INTERVAL_MINUTES = Number(
  process.env.PING_INTERVAL_MINUTES || 12
);

const MAX_CONCURRENT_PINGS = Number(
  process.env.MAX_CONCURRENT_PINGS || 5
);

const INTERVAL_MS =
  INTERVAL_MINUTES *
  60 *
  1000;

let schedulerStarted = false;
let stopping = false;

const now = () =>
  new Date().toISOString();

const sleep = async (
  milliseconds
) => {
  await new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
};

const runWithConcurrencyLimit =
  async (
    items,
    worker,
    limit
  ) => {
    const results =
      new Array(
        items.length
      );

    let nextIndex = 0;

    const workerLoop =
      async () => {
        while (
          !stopping
        ) {
          const index =
            nextIndex++;

          if (
            index >=
            items.length
          ) {
            return;
          }

          try {
            results[index] =
              await worker(
                items[index]
              );
          } catch (error) {
            results[index] =
              error;
          }
        }
      };

    const workerCount =
      Math.min(
        Math.max(
          1,
          limit
        ),
        items.length
      );

    await Promise.all(
      Array.from(
        {
          length:
            workerCount
        },
        () =>
          workerLoop()
      )
    );

    return results;
  };

const runCycle =
  async () => {
    if (stopping) {
      return;
    }

    const cycleStartedAt =
      Date.now();

    console.log(
      `\n[KeepAlive] [${now()}] ===== CYCLE START =====`
    );

    try {
      const urls =
        await Url.find({
          enabled: true
        })
          .select("_id url")
          .lean();

      if (
        !urls.length
      ) {
        console.log(
          `[KeepAlive] [${now()}] No enabled URLs.`
        );

        return;
      }

      console.log(
        `[KeepAlive] [${now()}] Starting cycle for ${urls.length} URL(s) | max concurrency=${MAX_CONCURRENT_PINGS}`
      );

      await runWithConcurrencyLimit(
        urls,
        (url) =>
          pingUrlById(
            url._id
          ),
        MAX_CONCURRENT_PINGS
      );

      console.log(
        `[KeepAlive] [${now()}] ===== CYCLE COMPLETE ===== | totalTime=${
          Date.now() -
          cycleStartedAt
        }ms`
      );
    } catch (error) {
      console.error(
        `[KeepAlive] [${now()}] Cycle error after ${
          Date.now() -
          cycleStartedAt
        }ms:`,
        error
      );
    }
  };

const schedulerLoop =
  async () => {
    /*
     * Run immediately after the server starts.
     */
    await runCycle();

    /*
     * After the initial cycle completes,
     * wait the configured interval.
     *
     * This is intentionally interval-based rather
     * than wall-clock cron based. It prevents:
     *
     * startup at 10:11
     * immediate cycle
     * cron at 10:12
     * second cycle one minute later
     */
    while (
      !stopping
    ) {
      console.log(
        `[KeepAlive] [${now()}] Next cycle in ${INTERVAL_MINUTES} minutes.`
      );

      await sleep(
        INTERVAL_MS
      );

      if (
        stopping
      ) {
        break;
      }

      await runCycle();
    }
  };

export const startScheduler =
  () => {
    if (
      schedulerStarted
    ) {
      console.warn(
        `[KeepAlive] [${now()}] Scheduler already started.`
      );

      return;
    }

    schedulerStarted =
      true;

    stopping = false;

    console.log(
      `[KeepAlive] [${now()}] Scheduler started | interval=${INTERVAL_MINUTES} minutes | ping timeout=${process.env.PING_TIMEOUT_MS || 70000}ms`
    );

    void schedulerLoop().catch(
      (error) => {
        console.error(
          `[KeepAlive] [${now()}] Scheduler crashed:`,
          error
        );

        schedulerStarted =
          false;
      }
    );
  };

export const stopScheduler =
  () => {
    stopping = true;

    console.log(
      `[KeepAlive] [${now()}] Scheduler stopping...`
    );
  };