import mongoose from "mongoose";
import { env } from "./env";

let isConnected = false;
let listenersRegistered = false;

const registerEventListeners = () => {
  if (listenersRegistered) return;

  // Handle connection events
  mongoose.connection.on("error", (error) => {
    console.error("MongoDB connection error:", error);
    isConnected = false;
  });

  mongoose.connection.on("disconnected", () => {
    console.log("MongoDB disconnected");
    isConnected = false;
  });

  mongoose.connection.on("reconnected", () => {
    console.log("MongoDB reconnected");
    isConnected = true;
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    await disconnectDB();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await disconnectDB();
    process.exit(0);
  });

  listenersRegistered = true;
};

export const connectDB = async (): Promise<void> => {
  if (isConnected) {
    console.log("MongoDB is already connected");
    return;
  }

  try {
    await mongoose.connect(env.MONGODB_URI);
    isConnected = true;
    console.log("MongoDB connected");

    // Register event listeners after successful connection
    registerEventListeners();
  } catch (error) {
    console.error("MongoDB connection error:", error);
    isConnected = false;
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log("MongoDB disconnected");
  } catch (error) {
    console.error("Error disconnecting from MongoDB:", error);
    throw error;
  }
};

export default mongoose;
