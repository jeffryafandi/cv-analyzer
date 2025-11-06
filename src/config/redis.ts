import { Redis } from "ioredis";
import { env } from "./env";

let redisClient: Redis | null = null;
let isConnected = false;
let listenersRegistered = false;

const registerEventListeners = () => {
  if (listenersRegistered || !redisClient) return;

  // Handle connection events
  redisClient.on("error", (error: Error) => {
    console.error("Redis connection error:", error);
    isConnected = false;
  });

  redisClient.on("connect", () => {
    console.log("Redis connecting...");
  });

  redisClient.on("ready", () => {
    console.log("Redis connected and ready");
    isConnected = true;
  });

  redisClient.on("close", () => {
    console.log("Redis connection closed");
    isConnected = false;
  });

  redisClient.on("reconnecting", () => {
    console.log("Redis reconnecting...");
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    await disconnectRedis();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await disconnectRedis();
    process.exit(0);
  });

  listenersRegistered = true;
};

export const connectRedis = async (): Promise<Redis> => {
  if (redisClient && isConnected) {
    console.log("Redis is already connected");
    return redisClient;
  }

  try {
    redisClient = new Redis(env.REDIS_URI, {
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: null,
    });

    // Register event listeners
    registerEventListeners();

    // Wait for connection to be ready
    await new Promise<void>((resolve, reject) => {
      if (!redisClient) {
        reject(new Error("Redis client not initialized"));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error("Redis connection timeout"));
      }, 5000);

      redisClient!.on("ready", () => {
        clearTimeout(timeout);
        resolve();
      });

      redisClient!.on("error", (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    return redisClient;
  } catch (error: unknown) {
    console.error("Redis connection error:", error);
    isConnected = false;
    throw error;
  }
};

export const disconnectRedis = async (): Promise<void> => {
  if (!redisClient || !isConnected) {
    return;
  }

  try {
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
    console.log("Redis disconnected");
  } catch (error: unknown) {
    console.error("Error disconnecting from Redis:", error);
    throw error;
  }
};

export const getRedisClient = (): Redis => {
  if (!redisClient || !isConnected) {
    throw new Error(
      "Redis client is not connected. Call connectRedis() first."
    );
  }
  return redisClient;
};

export default redisClient;
