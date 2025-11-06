import { connectDB } from "./config/db";
import { connectRedis } from "./config/redis";
import { getEvaluationWorker } from "./jobs/evaluation.worker";

const startWorker = async () => {
  try {
    console.log("starting worker...");

    // Connect to MongoDB and Redis
    await connectDB();
    await connectRedis();

    // Start the worker
    const worker = getEvaluationWorker();
    console.log("worker started");
    // Handle graceful shutdown
    const shutdown = async () => {
      console.log("shutting down worker...");
      await worker.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("failed to start worker:", error);
    process.exit(1);
  }
};

// Start the worker
startWorker();
