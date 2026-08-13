import dns from "node:dns/promises";
import net from "node:net";

import Url from "../models/Url.js";

/*
 * IMPORTANT:
 *
 * This is the TOTAL amount of time we are willing
 * to spend trying to wake/check a target.
 *
 * It is NOT just the timeout of one fetch().
 */
const TOTAL_PING_TIMEOUT_MS = Number(
  process.env.PING_TIMEOUT_MS || 70000
);

/*
 * A single HTTP request should not hang for the
 * entire 70 seconds.
 *
 * If one request itself hangs, abort it and use
 * the remaining time for another attempt.
 */
const SINGLE_REQUEST_TIMEOUT_MS = Number(
  process.env.SINGLE_REQUEST_TIMEOUT_MS || 15000
);

/*
 * Render cold starts can temporarily return 503.
 *
 * Retry delays are intentionally spread over roughly
 * one minute so a sleeping Render service has enough
 * time to start.
 */
const RETRY_DELAYS_MS = [
  5000,
  10000,
  20000,
  30000
];

const MAX_REDIRECTS = 5;

const activePings = new Set();

/* ------------------------------------------------ */
/* Logging helpers                                  */
/* ------------------------------------------------ */

const now = () =>
  new Date().toISOString();

const elapsed = (
  startedAt
) =>
  `${Date.now() - startedAt}ms`;

/* ------------------------------------------------ */
/* SSRF protection                                  */
/* ------------------------------------------------ */

const isPrivateIPv4 = (
  ip
) => {
  const parts = ip
    .split(".")
    .map(Number);

  if (
    parts.length !== 4 ||
    parts.some(
      (part) =>
        Number.isNaN(part) ||
        part < 0 ||
        part > 255
    )
  ) {
    return true;
  }

  const [a, b] = parts;

  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 &&
      b >= 16 &&
      b <= 31) ||
    (a === 192 && b === 168)
  );
};

const isPrivateIPv6 = (
  ip
) => {
  const normalized =
    ip.toLowerCase();

  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
};

const isPrivateAddress = (
  ip
) => {
  const family =
    net.isIP(ip);

  if (family === 4) {
    return isPrivateIPv4(ip);
  }

  if (family === 6) {
    return isPrivateIPv6(ip);
  }

  return true;
};

const validatePublicHostname =
  async (
    hostname
  ) => {
    const lower =
      hostname.toLowerCase();

    if (
      lower === "localhost" ||
      lower.endsWith(
        ".localhost"
      ) ||
      lower.endsWith(".local")
    ) {
      throw new Error(
        "Private or local hosts are not allowed"
      );
    }

    const addresses =
      await dns.lookup(
        hostname,
        {
          all: true
        }
      );

    if (
      !addresses.length
    ) {
      throw new Error(
        "Could not resolve hostname"
      );
    }

    for (
      const address of addresses
    ) {
      if (
        isPrivateAddress(
          address.address
        )
      ) {
        throw new Error(
          "Private or local network addresses are not allowed"
        );
      }
    }
  };

const validateTargetUrl =
  async (
    value
  ) => {
    let parsed;

    try {
      parsed = new URL(value);
    } catch {
      throw new Error(
        "Invalid URL"
      );
    }

    if (
      parsed.protocol !==
        "http:" &&
      parsed.protocol !==
        "https:"
    ) {
      throw new Error(
        "Only HTTP and HTTPS URLs are allowed"
      );
    }

    if (
      parsed.username ||
      parsed.password
    ) {
      throw new Error(
        "URLs containing credentials are not allowed"
      );
    }

    await validatePublicHostname(
      parsed.hostname
    );

    return parsed;
  };

const normalizeUrl =
  async (
    value
  ) => {
    const parsed =
      await validateTargetUrl(
        value.trim()
      );

    /*
     * Fragment is never sent to the server.
     */
    parsed.hash = "";

    return parsed.toString();
  };

/* ------------------------------------------------ */
/* Retry helpers                                    */
/* ------------------------------------------------ */

/*
 * These are the statuses we consider temporary.
 *
 * 503 is the important one for Render cold starts.
 */
const isRetryableStatus = (
  status
) => {
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
};

const sleep = async (
  milliseconds
) => {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
};

/* ------------------------------------------------ */
/* One HTTP attempt                                */
/* ------------------------------------------------ */

const requestOnce = async (
  targetUrl,
  remainingTime
) => {
  const requestTimeout =
    Math.min(
      SINGLE_REQUEST_TIMEOUT_MS,
      remainingTime
    );

  const controller =
    new AbortController();

  const requestStartedAt =
    Date.now();

  const timer =
    setTimeout(() => {
      controller.abort();
    }, requestTimeout);

  try {
    const response =
      await fetch(
        targetUrl,
        {
          method: "GET",

          /*
           * We handle redirects ourselves
           * so every redirect target can be
           * validated against SSRF.
           */
          redirect: "manual",

          signal:
            controller.signal,

          headers: {
            "User-Agent":
              "URL-KeepAlive/1.0",

            Accept:
              "text/html,application/json,*/*;q=0.8"
          }
        }
      );

    return {
      type: "response",

      status:
        response.status,

      statusText:
        response.statusText,

      location:
        response.headers.get(
          "location"
        ),

      responseTime:
        Date.now() -
        requestStartedAt
    };
  } catch (error) {
    return {
      type: "error",

      error,

      responseTime:
        Date.now() -
        requestStartedAt
    };
  } finally {
    clearTimeout(timer);
  }
};

/* ------------------------------------------------ */
/* Full ping with retry                             */
/* ------------------------------------------------ */

const performPing = async (
  initialUrl
) => {
  const startedAt =
    Date.now();

  let currentUrl =
    initialUrl;

  let attempt = 0;

  let lastStatusCode =
    null;

  let lastError =
    null;

  while (
    Date.now() -
      startedAt <
    TOTAL_PING_TIMEOUT_MS
  ) {
    attempt += 1;

    const elapsedMs =
      Date.now() -
      startedAt;

    const remainingTime =
      TOTAL_PING_TIMEOUT_MS -
      elapsedMs;

    if (
      remainingTime <= 0
    ) {
      break;
    }

    let parsed;

    try {
      parsed =
        await validateTargetUrl(
          currentUrl
        );
    } catch (error) {
      console.error(
        `[KeepAlive] [${now()}] [Attempt ${attempt}] Invalid target ${currentUrl}: ${error.message}`
      );

      return {
        status: "failed",
        statusCode: null,
        error: error.message,
        attempts: attempt,
        elapsedMs:
          Date.now() -
          startedAt
      };
    }

    console.log(
      `[KeepAlive] [${now()}] [Attempt ${attempt}] Pinging ${parsed.href} | elapsed=${Date.now() - startedAt}ms | remaining=${remainingTime}ms`
    );

    const result =
      await requestOnce(
        parsed.href,
        remainingTime
      );

    /*
     * Network / timeout failure.
     */
    if (
      result.type ===
      "error"
    ) {
      const error =
        result.error;

      lastStatusCode =
        null;

      lastError =
        error?.name ===
        "AbortError"
          ? `Request timed out after ${result.responseTime}ms`
          : error?.message ||
            "Request failed";

      console.error(
        `[KeepAlive] [${now()}] [Attempt ${attempt}] ✗ ${parsed.href} | error=${lastError} | requestTime=${result.responseTime}ms | totalElapsed=${Date.now() - startedAt}ms`
      );
    } else {
      lastStatusCode =
        result.status;

      /*
       * Successful response.
       */
      if (
        result.status >= 200 &&
        result.status < 300
      ) {
        console.log(
          `[KeepAlive] [${now()}] [Attempt ${attempt}] ✓ ${parsed.href} → ${result.status} ${result.statusText} | requestTime=${result.responseTime}ms | totalElapsed=${Date.now() - startedAt}ms`
        );

        return {
          status: "healthy",
          statusCode:
            result.status,
          error: null,
          attempts: attempt,
          elapsedMs:
            Date.now() -
            startedAt
        };
      }

      /*
       * Redirect.
       *
       * We validate the redirect target on the
       * next loop iteration.
       */
      if (
        result.status >= 300 &&
        result.status < 400
      ) {
        if (
          !result.location
        ) {
          lastError =
            `HTTP ${result.status} redirect without Location header`;
        } else if (
          attempt >
          MAX_REDIRECTS
        ) {
          lastError =
            "Too many redirects";
        } else {
          try {
            currentUrl =
              new URL(
                result.location,
                parsed.href
              ).href;

            console.log(
              `[KeepAlive] [${now()}] [Attempt ${attempt}] ↪ Redirect ${result.status} → ${currentUrl} | totalElapsed=${Date.now() - startedAt}ms`
            );

            continue;
          } catch {
            lastError =
              "Invalid redirect URL";
          }
        }
      } else {
        lastError =
          `HTTP ${result.status} ${result.statusText}`.trim();

        console.warn(
          `[KeepAlive] [${now()}] [Attempt ${attempt}] ✗ ${parsed.href} → ${result.status} | requestTime=${result.responseTime}ms | totalElapsed=${Date.now() - startedAt}ms`
        );

        /*
         * Non-retryable HTTP status.
         */
        if (
          !isRetryableStatus(
            result.status
          )
        ) {
          return {
            status: "failed",
            statusCode:
              result.status,
            error: lastError,
            attempts: attempt,
            elapsedMs:
              Date.now() -
              startedAt
          };
        }
      }
    }

    /*
     * If we've exhausted the retry window,
     * stop here.
     */
    const currentElapsed =
      Date.now() -
      startedAt;

    if (
      currentElapsed >=
      TOTAL_PING_TIMEOUT_MS
    ) {
      break;
    }

    /*
     * Determine retry delay.
     *
     * Once the predefined delays are exhausted,
     * continue using 10-second intervals until
     * the 70-second total deadline.
     */
    const delay =
      RETRY_DELAYS_MS[
        Math.min(
          attempt - 1,
          RETRY_DELAYS_MS.length -
            1
        )
      ] || 10000;

    const remainingAfterAttempt =
      TOTAL_PING_TIMEOUT_MS -
      currentElapsed;

    const actualDelay =
      Math.min(
        delay,
        remainingAfterAttempt
      );

    console.log(
      `[KeepAlive] [${now()}] [Attempt ${attempt}] Retry scheduled in ${actualDelay}ms | totalElapsed=${currentElapsed}ms`
    );

    await sleep(
      actualDelay
    );
  }

  const totalElapsed =
    Date.now() -
    startedAt;

  const finalError =
    lastError ||
    `Timed out after ${TOTAL_PING_TIMEOUT_MS / 1000}s`;

  console.error(
    `[KeepAlive] [${now()}] ✗ Final failure ${initialUrl} → ${
      lastStatusCode ??
      "NO RESPONSE"
    } | attempts=${attempt} | totalElapsed=${totalElapsed}ms | error=${finalError}`
  );

  return {
    status: "failed",
    statusCode:
      lastStatusCode,
    error: finalError,
    attempts: attempt,
    elapsedMs:
      totalElapsed
  };
};

/* ------------------------------------------------ */
/* Public ping function                             */
/* ------------------------------------------------ */

const pingUrlById =
  async (
    urlId
  ) => {
    const key =
      urlId.toString();

    /*
     * Don't ping the same URL twice
     * inside this Node process.
     */
    if (
      activePings.has(key)
    ) {
      console.log(
        `[KeepAlive] [${now()}] Skipping ${key} — ping already running.`
      );

      return {
        skipped: true,
        reason:
          "Ping already running"
      };
    }

    activePings.add(key);

    const cycleStartedAt =
      Date.now();

    try {
      const urlDoc =
        await Url.findOne({
          _id: urlId,
          enabled: true
        }).select(
          "_id url enabled"
        );

      if (!urlDoc) {
        console.log(
          `[KeepAlive] [${now()}] Skipping ${key} — URL not found or disabled.`
        );

        return {
          skipped: true,
          reason:
            "URL not found or disabled"
        };
      }

      console.log(
        `[KeepAlive] [${now()}] Starting ping: ${urlDoc.url}`
      );

      const result =
        await performPing(
          urlDoc.url
        );

      /*
       * Don't overwrite a URL that was disabled
       * or deleted while the ping was running.
       */
      const updateResult =
        await Url.updateOne(
          {
            _id: urlDoc._id,
            enabled: true
          },
          {
            $set: {
              lastStatus:
                result.status,

              lastStatusCode:
                result.statusCode,

              lastError:
                result.error,

              lastPingAt:
                new Date()
            }
          }
        );

      if (
        updateResult.matchedCount ===
        0
      ) {
        console.log(
          `[KeepAlive] [${now()}] Result ignored — URL was disabled or deleted.`
        );

        return {
          skipped: true,
          reason:
            "URL disabled or deleted"
        };
      }

      const totalTime =
        Date.now() -
        cycleStartedAt;

      console.log(
        `[KeepAlive] [${now()}] ${
          result.status ===
          "healthy"
            ? "✓"
            : "✗"
        } ${urlDoc.url} → ${
          result.statusCode ??
          "NO RESPONSE"
        } | attempts=${result.attempts} | pingTime=${result.elapsedMs}ms | total=${totalTime}ms`
      );

      return {
        skipped: false,
        ...result
      };
    } catch (error) {
      console.error(
        `[KeepAlive] [${now()}] Internal ping error for ${key} after ${
          Date.now() -
          cycleStartedAt
        }ms:`,
        error
      );

      return {
        skipped: false,
        status: "failed",
        statusCode: null,
        error:
          "Ping service encountered an internal error",
        attempts: 0,
        elapsedMs:
          Date.now() -
          cycleStartedAt
      };
    } finally {
      activePings.delete(key);
    }
  };

export {
  normalizeUrl,
  pingUrlById
};