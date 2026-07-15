import { Server } from "http";
import app from "./app";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./config/database";

let server: Server;
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log("HTTP server closed");
      try {
        await disconnectDatabase();
        console.log("Cleanup complete. Exiting.");
        process.exit(0);
      } catch (error) {
        console.error("Error during graceful shutdown cleanup");
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGINT", () => {
  gracefulShutdown("SIGINT").catch(() => process.exit(1));
});

process.on("SIGTERM", () => {
  gracefulShutdown("SIGTERM").catch(() => process.exit(1));
});

async function bootstrap(): Promise<void> {
  try {
    await connectDatabase();
    server = app.listen(env.PORT, () => {
      console.log(`Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });
  } catch (error) {
    console.error("Bootstrap failed to initialize database connection");
    process.exit(1);
  }
}

bootstrap().catch(() => process.exit(1));
