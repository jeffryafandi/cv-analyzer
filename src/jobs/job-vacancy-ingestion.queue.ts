import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { getRedisClient } from "../config/redis";
import { JobVacancyIngestionJobData } from "../types/jobs";

// Create the job vacancy ingestion queue
// Note: This will be initialized after Redis connection is established
let jobVacancyIngestionQueue: Queue<JobVacancyIngestionJobData> | null = null;

export const getJobVacancyIngestionQueue =
  (): Queue<JobVacancyIngestionJobData> => {
    if (!jobVacancyIngestionQueue) {
      const redisClient = getRedisClient();
      jobVacancyIngestionQueue = new Queue<JobVacancyIngestionJobData>(
        "job-vacancy-ingestion",
        {
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
        }
      );
    }
    return jobVacancyIngestionQueue;
  };

// Helper function to add a job to the queue
export const addJobVacancyIngestionJob = async (
  data: JobVacancyIngestionJobData
) => {
  const queue = getJobVacancyIngestionQueue();
  return await queue.add("ingest", data, {
    jobId: data.vacancyId, // Use vacancyId as the BullMQ job ID
  });
};
