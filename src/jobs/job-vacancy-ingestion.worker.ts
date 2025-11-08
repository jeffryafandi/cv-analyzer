import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { getRedisClient } from "../config/redis";
import { JobVacancyModel } from "../models/job-vacancy.model";
import { JobVacancyIngestionJobData } from "../types/jobs";
import { ingestJobVacancy } from "../services/job-ingestion.service";

// Create the job vacancy ingestion worker
// Note: This will be initialized after Redis connection is established
let jobVacancyIngestionWorker: Worker<JobVacancyIngestionJobData> | null = null;

/**
 * Helper function to log to both console and BullMQ job logs
 * @param job - BullMQ job instance
 * @param message - Log message
 */
async function logToJob(
  job: Job<JobVacancyIngestionJobData>,
  message: string
): Promise<void> {
  // Log to console for immediate visibility
  console.log(message);
  // Save to BullMQ job logs
  await job.log(message);
}

export const getJobVacancyIngestionWorker =
  (): Worker<JobVacancyIngestionJobData> => {
    if (!jobVacancyIngestionWorker) {
      const redisClient = getRedisClient();
      jobVacancyIngestionWorker = new Worker<JobVacancyIngestionJobData>(
        "job-vacancy-ingestion",
        async (job: Job<JobVacancyIngestionJobData>) => {
          const {
            vacancyId,
            jobDescriptionFileId,
            cvRubricFileId,
            caseStudyBriefFileId,
            projectRubricFileId,
            type,
          } = job.data;
          const startTime = Date.now();

          await logToJob(
            job,
            `\n🔄 [${new Date().toISOString()}] Processing job vacancy ingestion ${vacancyId}`
          );
          await logToJob(job, `   Type: ${type}`);
          await logToJob(
            job,
            `   Job Description File ID: ${jobDescriptionFileId}`
          );
          await logToJob(job, `   CV Rubric File ID: ${cvRubricFileId}`);
          if (caseStudyBriefFileId) {
            await logToJob(
              job,
              `   Case Study Brief File ID: ${caseStudyBriefFileId}`
            );
          }
          if (projectRubricFileId) {
            await logToJob(
              job,
              `   Project Rubric File ID: ${projectRubricFileId}`
            );
          }

          try {
            // Check if job vacancy exists
            const vacancy = await JobVacancyModel.findOne({ vacancyId });
            if (!vacancy) {
              throw new Error(`Job vacancy with ID ${vacancyId} not found`);
            }

            // Update status to processing
            await logToJob(
              job,
              `   Updating job vacancy status to 'processing'...`
            );
            await JobVacancyModel.findOneAndUpdate(
              { vacancyId },
              {
                status: "processing",
                updatedAt: new Date(),
              }
            );

            // Ingest job vacancy (extract text, ingest to ChromaDB, generate queries, standardize rubrics)
            await logToJob(job, `   Starting ingestion process...`);
            const ingestionResult = await ingestJobVacancy(
              vacancyId,
              jobDescriptionFileId,
              cvRubricFileId,
              caseStudyBriefFileId,
              projectRubricFileId,
              type
            );

            await logToJob(job, `   ✓ Ingestion completed successfully`);
            await logToJob(
              job,
              `   Generated ${ingestionResult.cvEvaluationQueries.length} CV evaluation queries`
            );
            if (ingestionResult.projectEvaluationQueries) {
              await logToJob(
                job,
                `   Generated ${ingestionResult.projectEvaluationQueries.length} project evaluation queries`
              );
            }

            // Update job vacancy with ingestion results
            await logToJob(
              job,
              `   Updating job vacancy with ingestion results...`
            );
            await JobVacancyModel.findOneAndUpdate(
              { vacancyId },
              {
                standardizedCvRubric: ingestionResult.standardizedCvRubric,
                standardizedProjectRubric:
                  ingestionResult.standardizedProjectRubric,
                cvEvaluationQueries: ingestionResult.cvEvaluationQueries,
                projectEvaluationQueries:
                  ingestionResult.projectEvaluationQueries,
                status: "active",
                updatedAt: new Date(),
              }
            );

            const totalTime = Date.now() - startTime;
            await logToJob(
              job,
              `\n✅ [${new Date().toISOString()}] Job vacancy ingestion ${vacancyId} completed successfully`
            );
            await logToJob(
              job,
              `   Total processing time: ${totalTime}ms (${(
                totalTime / 1000
              ).toFixed(2)}s)`
            );

            return {
              success: true,
              vacancyId,
              ingestionResult,
            };
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            const totalTime = Date.now() - startTime;

            const errorLog = `\n❌ [${new Date().toISOString()}] Job vacancy ingestion ${vacancyId} failed after ${totalTime}ms\n   Error: ${errorMessage}`;
            console.error(errorLog);
            if (error instanceof Error && error.stack) {
              console.error(`   Stack trace:`, error.stack);
              await job.log(`   Stack trace: ${error.stack}`);
            }
            await job.log(errorLog);

            // Update job vacancy status to failed
            await JobVacancyModel.findOneAndUpdate(
              { vacancyId },
              {
                status: "failed",
                updatedAt: new Date(),
              }
            );

            throw error;
          }
        },
        {
          connection: redisClient as unknown as Redis,
          concurrency: 3, // Process up to 3 jobs concurrently
          limiter: {
            max: 5, // Max 5 jobs
            duration: 1000, // Per second
          },
        }
      );

      // Event listeners for monitoring
      jobVacancyIngestionWorker.on("completed", (job) => {
        console.log(
          `\n✅ [${new Date().toISOString()}] Worker: Job vacancy ingestion ${
            job.id
          } completed`
        );
      });

      jobVacancyIngestionWorker.on("failed", (job, err) => {
        console.error(
          `\n❌ [${new Date().toISOString()}] Worker: Job vacancy ingestion ${
            job?.id
          } failed`
        );
        console.error(`   Error: ${err.message}`);
        if (err.stack) {
          console.error(`   Stack trace:`, err.stack);
        }
      });

      jobVacancyIngestionWorker.on("error", (err) => {
        console.error(`\n❌ [${new Date().toISOString()}] Worker error:`, err);
      });

      jobVacancyIngestionWorker.on("active", (job) => {
        console.log(
          `\n🔄 [${new Date().toISOString()}] Worker: Job vacancy ingestion ${
            job.id
          } started processing`
        );
      });
    }
    return jobVacancyIngestionWorker;
  };
