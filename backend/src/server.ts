import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { pool, prisma } from "./lib/prisma.js";
import { startScheduler } from "./modules/cron/scheduler.js";
import { flushNotifications } from "./services/notify/index.js";

const server = createApp().listen(env.PORT, () => {
  logger.info(`Haat API listening on http://localhost:${env.PORT}/api/v1`);
});

// Serverless hosts trigger /cron/daily externally; a long-running server can run it itself.
if (env.ENABLE_SCHEDULER) startScheduler();

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  server.close(async () => {
    await flushNotifications();
    await prisma.$disconnect();
    // The pool is ours (lib/prisma.ts), so Prisma does not close it.
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => logger.error({ err: reason }, "Unhandled promise rejection"));
