import { logger } from "../../lib/logger.js";
import { minutesOfDayIST } from "../branches/shop-status.js";
import { todayIST } from "../pricing/subscription.js";
import { runDaily } from "./daily.service.js";

const RUN_AT_MINUTE_IST = 18 * 60;
const CHECK_EVERY_MS = 60_000;

/**
 * For a single long-running server (Render, EC2): runs the daily job once per IST day at 18:00.
 * Serverless hosts use the /cron/daily endpoint instead. With several instances, keep this on one.
 */
export function startScheduler() {
  let lastRunDay: string | null = null;
  const tick = async () => {
    const now = new Date();
    const day = todayIST(now);
    if (lastRunDay === day || minutesOfDayIST(now) < RUN_AT_MINUTE_IST) return;
    lastRunDay = day;
    try {
      logger.info({ result: await runDaily(now) }, "Daily job finished");
    } catch (error) {
      lastRunDay = null;
      logger.error({ err: error }, "Daily job failed; will retry");
    }
  };
  const timer = setInterval(() => void tick(), CHECK_EVERY_MS);
  timer.unref();
  logger.info("In-process scheduler started (daily job at 18:00 IST)");
  return () => clearInterval(timer);
}
