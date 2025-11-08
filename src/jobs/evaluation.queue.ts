import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { getRedisClient } from "../config/redis";

export interface EvaluationJobData {
  jobId: string;
  cvId: string;
  reportId: string;
  jobTitle: string;
}

// Create the evaluation queue
// Note: This will be initialized after Redis connection is established
let evaluationQueue: Queue<EvaluationJobData> | null = null;

export const getEvaluationQueue = (): Queue<EvaluationJobData> => {
  if (!evaluationQueue) {
    const redisClient = getRedisClient();
    evaluationQueue = new Queue<EvaluationJobData>("evaluation", {
      connection: redisClient as unknown as Redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000, // Keep max 1000 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });
  }
  return evaluationQueue;
};

// Helper function to add a job to the queue
export const addEvaluationJob = async (data: EvaluationJobData) => {
  const queue = getEvaluationQueue();
  return await queue.add("evaluate", data, {
    jobId: data.jobId, // Use jobId as the BullMQ job ID
  });
};
