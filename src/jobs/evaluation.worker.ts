import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { getRedisClient } from "../config/redis";
import { JobModel } from "../models/job.model";
import { EvaluationJobData } from "./evaluation.queue";

// Create the evaluation worker
// Note: This will be initialized after Redis connection is established
let evaluationWorker: Worker<EvaluationJobData> | null = null;

export const getEvaluationWorker = (): Worker<EvaluationJobData> => {
  if (!evaluationWorker) {
    const redisClient = getRedisClient();
    evaluationWorker = new Worker<EvaluationJobData>(
      "evaluation",
      async (job: Job<EvaluationJobData>) => {
        const { jobId, fileIds, jobTitle } = job.data;

        console.log(
          `🔄 Processing job ${jobId} with ${fileIds.length} file(s)`
        );

        try {
          // Update job status to processing
          await JobModel.findOneAndUpdate(
            { jobId },
            {
              status: "processing",
              updatedAt: new Date(),
            }
          );

          // TODO: Implement actual evaluation logic
          // - Parse PDF files
          // - Extract text/content
          // - Run AI evaluation (RAG + LLM)
          // - Generate results

          // Simulate processing time
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Mock result for now
          const result = {
            score: 85,
            evaluation: "CV evaluation completed successfully",
            recommendations: [
              "Add more technical skills",
              "Include project portfolio",
            ],
          };

          // Update job status to completed
          await JobModel.findOneAndUpdate(
            { jobId },
            {
              status: "completed",
              result,
              updatedAt: new Date(),
            }
          );

          console.log(`✅ Job ${jobId} completed successfully`);

          return result;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          console.error(`❌ Job ${jobId} failed:`, errorMessage);

          // Update job status to failed
          await JobModel.findOneAndUpdate(
            { jobId },
            {
              status: "failed",
              error: errorMessage,
              updatedAt: new Date(),
            }
          );

          throw error;
        }
      },
      {
        connection: redisClient as unknown as Redis,
        concurrency: 5, // Process up to 5 jobs concurrently
        limiter: {
          max: 10, // Max 10 jobs
          duration: 1000, // Per second
        },
      }
    );

    // Event listeners for monitoring
    evaluationWorker.on("completed", (job) => {
      console.log(`✅ Job ${job.id} completed`);
    });

    evaluationWorker.on("failed", (job, err) => {
      console.error(`❌ Job ${job?.id} failed:`, err.message);
    });

    evaluationWorker.on("error", (err) => {
      console.error("Worker error:", err);
    });
  }
  return evaluationWorker;
};
