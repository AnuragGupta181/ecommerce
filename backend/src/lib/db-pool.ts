import pg from "pg";
import { logger } from "./logger.js";

const CONNECT_ATTEMPTS = 3;

type ConnectCallback = (err: Error | undefined, client: pg.PoolClient | undefined, done: (release?: unknown) => void) => void;

function isConnectTimeout(error: unknown): boolean {
  return error instanceof Error && /timeout/i.test(error.message);
}

/**
 * A pool whose connects retry after a timeout. Opening a Neon connection occasionally stalls
 * and never completes, while a fresh attempt succeeds, so a stalled connect is abandoned and
 * retried instead of failing the request. Queries themselves are never retried.
 */
export class RetryingPool extends pg.Pool {
  constructor(config: pg.PoolConfig) {
    super(config);
    // An idle client dropped by the server emits here; unhandled, it would crash the process.
    this.on("error", (error) => logger.warn({ err: error }, "Idle database connection closed"));
  }

  private async connectWithRetry(): Promise<pg.PoolClient> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await super.connect();
      } catch (error) {
        if (attempt >= CONNECT_ATTEMPTS || !isConnectTimeout(error)) throw error;
        logger.warn({ attempt }, "Database connect timed out; retrying");
      }
    }
  }

  override connect(): Promise<pg.PoolClient>;
  override connect(callback: ConnectCallback): void;
  // pg-pool's own query() uses the callback form, so both forms must retry.
  override connect(callback?: ConnectCallback): Promise<pg.PoolClient> | void {
    const connecting = this.connectWithRetry();
    if (!callback) return connecting;
    connecting.then(
      (client) => callback(undefined, client, (release) => client.release(release as Error | boolean | undefined)),
      (error: Error) => callback(error, undefined, () => undefined),
    );
  }
}
