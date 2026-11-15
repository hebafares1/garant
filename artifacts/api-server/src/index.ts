import app from "./app";
import { releaseExpiredOrders } from "./lib/garant";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

const releaseCheck = setInterval(() => {
  void releaseExpiredOrders().catch((error: unknown) => {
    logger.error({ error }, "Automatic simulated payment release failed");
  });
}, 60_000);
releaseCheck.unref();
void releaseExpiredOrders().catch((error: unknown) => {
  logger.error({ error }, "Initial simulated payment release check failed");
});
