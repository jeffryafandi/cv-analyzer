import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { getRedisClient } from "../config/redis";
import { JobModel } from "../models/job.model";
import { JobVacancyModel } from "../models/job-vacancy.model";
import { FileModel } from "../models/file.model";
import { EvaluationJobData } from "../types/jobs";
import { extractTextFromPDF } from "../services/pdf.service";
import {
  queryVectorDB,
  queryVectorDBWithCosineSimilarity,
  callLLM,
  buildCVEvaluationPrompt,
  buildProjectEvaluationPrompt,
  buildSummaryPrompt,
  parseLLMResponse,
} from "../services/ai.service";
import { getFilePath } from "../services/storage.service";
import {
  CVEvaluationResult,
  ProjectEvaluationResult,
  SummaryResult,
  CVResults,
  ProjectResults,
} from "../types/services";

// Create the evaluation worker
// Note: This will be initialized after Redis connection is established
let evaluationWorker: Worker<EvaluationJobData> | null = null;

/**
 * Helper function to log to both console and BullMQ job logs
 * @param job - BullMQ job instance
 * @param message - Log message
 */
async function logToJob(
  job: Job<EvaluationJobData>,
  message: string
): Promise<void> {
  // Log to console for immediate visibility
  console.log(message);
  // Save to BullMQ job logs
  await job.log(message);
}

export const getEvaluationWorker = (): Worker<EvaluationJobData> => {
  if (!evaluationWorker) {
    const redisClient = getRedisClient();
    evaluationWorker = new Worker<EvaluationJobData>(
      "evaluation",
      async (job: Job<EvaluationJobData>) => {
        const { jobId, cvId, reportId, vacancyId } = job.data;
        const startTime = Date.now();

        await logToJob(
          job,
          `\n🔄 [${new Date().toISOString()}] Processing job ${jobId}`
        );
        await logToJob(job, `   Vacancy ID: ${vacancyId}`);
        await logToJob(job, `   CV ID: ${cvId}`);
        await logToJob(job, `   Report ID: ${reportId || "N/A"}`);

        // Fetch job vacancy
        const vacancy = await JobVacancyModel.findOne({ vacancyId });
        if (!vacancy) {
          throw new Error(`Job vacancy with ID ${vacancyId} not found`);
        }

        await logToJob(job, `   Job Title: ${vacancy.title}`);
        await logToJob(job, `   Job Type: ${vacancy.type}`);

        try {
          // Update job status to processing
          await logToJob(job, `   Updating job status to 'processing'...`);
          await JobModel.findOneAndUpdate(
            { jobId },
            {
              status: "processing",
              updatedAt: new Date(),
            }
          );

          // Retrieve file documents
          await logToJob(job, `   Retrieving file documents...`);
          const cvFile = await FileModel.findById(cvId);

          if (!cvFile) {
            throw new Error(`CV file with ID ${cvId} not found`);
          }

          await logToJob(job, `   ✓ CV file: ${cvFile.filename}`);

          // Only fetch report file if required
          let reportFile = null;
          if (reportId) {
            reportFile = await FileModel.findById(reportId);
            if (!reportFile) {
              throw new Error(`Report file with ID ${reportId} not found`);
            }
            await logToJob(job, `   ✓ Report file: ${reportFile.filename}`);
          } else if (vacancy.type === "cv_with_test") {
            throw new Error(
              "Report file is required for cv_with_test job vacancies"
            );
          }

          /* CV Evaluation 
          
          - Compare CV embedding with documents from ChromaDB using explicit cosine similarity
          - Extract just the text and metadata (remove similarity scores for prompt building)
          - Build CV evaluation prompt
          - Call LLM for CV evaluation
          - Calculate weighted CV score
          - Convert to 0-1 scale (multiply by 0.2)
          - Log CV match rate
          */
          await logToJob(
            job,
            `========== STAGE 1: CV Evaluation for job ${jobId} ==========\n`
          );

          // Extract CV text
          await logToJob(job, `   Extracting text from CV PDF...`);
          const cvFilePath = getFilePath(cvFile.filename);
          const cvText = await extractTextFromPDF(cvFilePath);
          await logToJob(
            job,
            `   ✓ Extracted ${cvText.length} characters from CV`
          );
          // Log CV text preview
          const cvPreview =
            cvText.length > 1000
              ? cvText.substring(0, 1000) + "... [truncated]"
              : cvText;
          await logToJob(job, `   --- CV Text Preview ---`);
          await logToJob(job, cvPreview);
          await logToJob(job, `   --- End of CV Text Preview ---`);

          // RAG query for CV evaluation context using cosine similarity
          await logToJob(job, `   Querying ChromaDB with cosine similarity...`);
          await logToJob(
            job,
            `   Collections: cv_rubrics, job_documents (filtered by vacancy ${vacancyId})`
          );

          // Use vacancy-specific queries if available, otherwise use CV text
          const cvQuery =
            vacancy.cvEvaluationQueries &&
            vacancy.cvEvaluationQueries.length > 0
              ? vacancy.cvEvaluationQueries[0]
              : cvText;

          await logToJob(
            job,
            `   Using query: ${cvQuery.substring(0, 100)}...`
          );

          const cvContextWithScores = await queryVectorDBWithCosineSimilarity(
            cvQuery,
            ["cv_rubrics", "job_documents"],
            10,
            vacancyId
          );

          // Log similarity scores and detailed chunks
          if (cvContextWithScores.length > 0) {
            await logToJob(
              job,
              `   ✓ Retrieved ${cvContextWithScores.length} context chunks with cosine similarity:`
            );
            for (const [idx, result] of cvContextWithScores.entries()) {
              const source = result.metadata?.source || "unknown";
              const chunkIndex = result.metadata?.chunk_index ?? "N/A";
              await logToJob(
                job,
                `      [${idx + 1}] Similarity: ${result.similarity.toFixed(
                  4
                )} | Source: ${source} | Chunk Index: ${chunkIndex}`
              );
              // Log full chunk text (truncated if too long)
              const chunkPreview =
                result.text.length > 500
                  ? result.text.substring(0, 500) + "... [truncated]"
                  : result.text;
              await logToJob(job, `         Chunk Text: ${chunkPreview}`);
            }
          } else {
            await logToJob(job, `   ⚠ No context chunks retrieved`);
          }

          // Extract just the text and metadata (remove similarity scores for prompt building)
          const cvContext = cvContextWithScores.map(({ text, metadata }) => ({
            text,
            metadata,
          }));

          // Build CV evaluation prompt
          await logToJob(job, `   Building CV evaluation prompt...`);
          const cvPrompt = buildCVEvaluationPrompt(cvText, cvContext);
          await logToJob(
            job,
            `   ✓ CV Prompt length: ${cvPrompt.length} characters`
          );
          // Log full prompt
          await logToJob(job, `   --- CV Evaluation Prompt ---`);
          await logToJob(job, cvPrompt);
          await logToJob(job, `   --- End of CV Prompt ---`);

          // Call LLM for CV evaluation
          await logToJob(job, `   Calling LLM for CV evaluation...`);
          const cvLLMStartTime = Date.now();
          const cvResponse = await callLLM(cvPrompt);
          const cvLLMTime = Date.now() - cvLLMStartTime;
          await logToJob(job, `   ✓ LLM response received (${cvLLMTime}ms)`);

          // Log full LLM response
          await logToJob(job, `   --- CV LLM Raw Response ---`);
          await logToJob(job, cvResponse);
          await logToJob(job, `   --- End of CV LLM Response ---`);

          await logToJob(job, `   Parsing LLM response...`);
          const cvEvaluation = parseLLMResponse<CVEvaluationResult>(cvResponse);

          // Log parsed evaluation result
          await logToJob(job, `   --- CV Parsed Evaluation Result ---`);
          await logToJob(job, JSON.stringify(cvEvaluation, null, 2));
          await logToJob(job, `   --- End of CV Evaluation Result ---`);

          // Log detailed scores
          await logToJob(job, `   ✓ CV Evaluation Scores:`);
          await logToJob(
            job,
            `      - Technical Skills: ${cvEvaluation.technical_skills}/5 (weight: 0.4)`
          );
          await logToJob(
            job,
            `      - Experience Level: ${cvEvaluation.experience_level}/5 (weight: 0.25)`
          );
          await logToJob(
            job,
            `      - Achievements: ${cvEvaluation.achievements}/5 (weight: 0.2)`
          );
          await logToJob(
            job,
            `      - Cultural Fit: ${cvEvaluation.cultural_fit}/5 (weight: 0.15)`
          );

          // Calculate weighted CV match rate using standardized rubric weights
          const cvRubric = vacancy.standardizedCvRubric;
          const cvWeightedScore =
            cvEvaluation.technical_skills * cvRubric.technical_skills.weight +
            cvEvaluation.experience_level * cvRubric.experience_level.weight +
            cvEvaluation.achievements * cvRubric.achievements.weight +
            cvEvaluation.cultural_fit * cvRubric.cultural_fit.weight;

          // Convert to 0-1 scale (multiply by 0.2)
          const cvMatchRate = cvWeightedScore / 5;

          await logToJob(
            job,
            `   ✓ Weighted Score: ${cvWeightedScore.toFixed(2)}/5`
          );
          await logToJob(
            job,
            `   ✓ CV Match Rate: ${cvMatchRate.toFixed(4)} (${(
              cvMatchRate * 100
            ).toFixed(2)}%)`
          );

          /* Project Evaluation 
          
          - Only run if vacancy type is cv_with_test
          - Compare project report embedding with documents from ChromaDB using explicit cosine similarity
          - Extract just the text and metadata (remove similarity scores for prompt building)
          - Build project evaluation prompt
          - Call LLM for project evaluation
          - Calculate weighted project score
          - Convert to 0-1 scale (multiply by 0.2)
          - Log project match rate
          */

          // Initialize project evaluation variables
          let projectScore = 0;
          let projectEvaluation: ProjectEvaluationResult | null = null;

          // Only evaluate project if vacancy type is cv_with_test
          if (vacancy.type !== "cv_with_test") {
            await logToJob(
              job,
              `========== STAGE 2: Project Evaluation SKIPPED (job type is cv_only) ==========\n`
            );
          } else {
            await logToJob(
              job,
              `========== STAGE 2: Project Evaluation for job ${jobId} ==========\n`
            );

            // Extract report text
            await logToJob(
              job,
              `   Extracting text from project report PDF...`
            );
            const reportFilePath = getFilePath(reportFile.filename);
            const reportText = await extractTextFromPDF(reportFilePath);
            await logToJob(
              job,
              `   ✓ Extracted ${reportText.length} characters from report`
            );
            // Log report text preview
            const reportPreview =
              reportText.length > 1000
                ? reportText.substring(0, 1000) + "... [truncated]"
                : reportText;
            await logToJob(job, `   --- Project Report Text Preview ---`);
            await logToJob(job, reportPreview);
            await logToJob(job, `   --- End of Report Text Preview ---`);

            // RAG query for project evaluation context
            await logToJob(
              job,
              `   Querying ChromaDB for project evaluation context...`
            );
            await logToJob(
              job,
              `   Collections: project_rubrics, case_studies (filtered by vacancy ${vacancyId})`
            );

            // Use vacancy-specific queries if available
            const projectQuery =
              vacancy.projectEvaluationQueries &&
              vacancy.projectEvaluationQueries.length > 0
                ? vacancy.projectEvaluationQueries[0]
                : "project implementation requirements, code quality, RAG implementation, scoring rubric, weights";

            await logToJob(
              job,
              `   Using query: ${projectQuery.substring(0, 100)}...`
            );

            const projectContext = await queryVectorDB(
              projectQuery,
              ["project_rubrics", "case_studies"],
              10,
              vacancyId
            );
            await logToJob(
              job,
              `   ✓ Retrieved ${projectContext.length} context chunks`
            );

            // Log detailed project context chunks
            if (projectContext.length > 0) {
              await logToJob(job, `   --- Project Context Chunks ---`);
              for (const [idx, chunk] of projectContext.entries()) {
                const source = chunk.metadata?.source || "unknown";
                const chunkIndex = chunk.metadata?.chunk_index ?? "N/A";
                await logToJob(
                  job,
                  `      [${
                    idx + 1
                  }] Source: ${source} | Chunk Index: ${chunkIndex}`
                );
                // Log full chunk text (truncated if too long)
                const chunkPreview =
                  chunk.text.length > 500
                    ? chunk.text.substring(0, 500) + "... [truncated]"
                    : chunk.text;
                await logToJob(job, `         Chunk Text: ${chunkPreview}`);
              }
              await logToJob(job, `   --- End of Project Context Chunks ---`);
            }

            // Build project evaluation prompt
            await logToJob(job, `   Building project evaluation prompt...`);
            const projectPrompt = buildProjectEvaluationPrompt(
              reportText,
              projectContext
            );
            await logToJob(
              job,
              `   ✓ Project Prompt length: ${projectPrompt.length} characters`
            );
            // Log full prompt
            await logToJob(job, `   --- Project Evaluation Prompt ---`);
            await logToJob(job, projectPrompt);
            await logToJob(job, `   --- End of Project Prompt ---`);

            // Call LLM for project evaluation
            await logToJob(job, `   Calling LLM for project evaluation...`);
            const projectLLMStartTime = Date.now();
            const projectResponse = await callLLM(projectPrompt);
            const projectLLMTime = Date.now() - projectLLMStartTime;
            await logToJob(
              job,
              `   ✓ LLM response received (${projectLLMTime}ms)`
            );

            // Log full LLM response
            await logToJob(job, `   --- Project LLM Raw Response ---`);
            await logToJob(job, projectResponse);
            await logToJob(job, `   --- End of Project LLM Response ---`);

            await logToJob(job, `   Parsing LLM response...`);
            projectEvaluation =
              parseLLMResponse<ProjectEvaluationResult>(projectResponse);

            // Log parsed evaluation result
            await logToJob(job, `   --- Project Parsed Evaluation Result ---`);
            await logToJob(job, JSON.stringify(projectEvaluation, null, 2));
            await logToJob(job, `   --- End of Project Evaluation Result ---`);

            // Check if document is relevant
            const isRelevant = projectEvaluation.is_relevant !== false; // Default to true if not specified

            if (!isRelevant) {
              await logToJob(
                job,
                `   ⚠ Document is not a project report - skipping detailed scores`
              );
              await logToJob(job, `   Feedback: ${projectEvaluation.feedback}`);
              // Set projectScore to 0 for irrelevant documents
              projectScore = 0;
            } else {
              // Verify all required score fields are present
              if (
                typeof projectEvaluation.correctness !== "number" ||
                typeof projectEvaluation.code_quality !== "number" ||
                typeof projectEvaluation.resilience !== "number" ||
                typeof projectEvaluation.documentation !== "number" ||
                typeof projectEvaluation.creativity !== "number"
              ) {
                await logToJob(
                  job,
                  `   ⚠ Missing score fields in LLM response - treating as irrelevant`
                );
                projectScore = 0;
                projectEvaluation.is_relevant = false;
              } else {
                // Log detailed scores only if document is relevant
                await logToJob(job, `   ✓ Project Evaluation Scores:`);
                await logToJob(
                  job,
                  `      - Correctness: ${projectEvaluation.correctness}/5 (weight: 0.3)`
                );
                await logToJob(
                  job,
                  `      - Code Quality: ${projectEvaluation.code_quality}/5 (weight: 0.25)`
                );
                await logToJob(
                  job,
                  `      - Resilience: ${projectEvaluation.resilience}/5 (weight: 0.2)`
                );
                await logToJob(
                  job,
                  `      - Documentation: ${projectEvaluation.documentation}/5 (weight: 0.15)`
                );
                await logToJob(
                  job,
                  `      - Creativity: ${projectEvaluation.creativity}/5 (weight: 0.1)`
                );

                // Calculate weighted project score using standardized rubric weights
                const projectRubric = vacancy.standardizedProjectRubric;
                if (!projectRubric) {
                  throw new Error(
                    "Standardized project rubric not found for cv_with_test vacancy"
                  );
                }

                projectScore =
                  projectEvaluation.correctness *
                    projectRubric.correctness.weight +
                  projectEvaluation.code_quality *
                    projectRubric.code_quality.weight +
                  projectEvaluation.resilience *
                    projectRubric.resilience.weight +
                  projectEvaluation.documentation *
                    projectRubric.documentation.weight +
                  projectEvaluation.creativity *
                    projectRubric.creativity.weight;

                await logToJob(
                  job,
                  `   ✓ Weighted Score: ${projectScore.toFixed(2)}/5`
                );
                await logToJob(
                  job,
                  `   ✓ Project Score: ${projectScore.toFixed(4)}/5 (${(
                    projectScore * 20
                  ).toFixed(2)}%)`
                );
              }
            }
          } // End of project evaluation else block

          /* Overall Summary 
          
          - Build summary prompt
          - Call LLM for summary
          - Extract overall summary
          - Log overall summary
          */
          await logToJob(
            job,
            `========== STAGE 3: Overall Summary for job ${jobId} ==========\n`
          );

          const cvResults: CVResults = {
            cv_match_rate: cvMatchRate,
            cv_feedback: cvEvaluation.feedback,
            cv_detailed_scores: {
              technical_skills: cvEvaluation.technical_skills,
              experience_level: cvEvaluation.experience_level,
              achievements: cvEvaluation.achievements,
              cultural_fit: cvEvaluation.cultural_fit,
            },
          };

          const projectResults: ProjectResults | null = projectEvaluation
            ? {
                project_score: projectScore,
                project_feedback: projectEvaluation.feedback,
                // Only include detailed scores if document is relevant
                project_detailed_scores:
                  projectEvaluation.is_relevant !== false
                    ? {
                        correctness: projectEvaluation.correctness,
                        code_quality: projectEvaluation.code_quality,
                        resilience: projectEvaluation.resilience,
                        documentation: projectEvaluation.documentation,
                        creativity: projectEvaluation.creativity,
                      }
                    : undefined,
              }
            : null;

          // Build summary prompt
          await logToJob(job, `   Building overall summary prompt...`);
          const summaryPrompt = buildSummaryPrompt(cvResults, projectResults);
          await logToJob(
            job,
            `   ✓ Summary Prompt length: ${summaryPrompt.length} characters`
          );
          // Log full prompt
          await logToJob(job, `   --- Summary Prompt ---`);
          await logToJob(job, summaryPrompt);
          await logToJob(job, `   --- End of Summary Prompt ---`);

          // Call LLM for summary
          await logToJob(job, `   Calling LLM for overall summary...`);
          const summaryLLMStartTime = Date.now();
          const summaryResponse = await callLLM(summaryPrompt);
          const summaryLLMTime = Date.now() - summaryLLMStartTime;
          await logToJob(
            job,
            `   ✓ LLM response received (${summaryLLMTime}ms)`
          );

          // Log full LLM response
          await logToJob(job, `   --- Summary LLM Raw Response ---`);
          await logToJob(job, summaryResponse);
          await logToJob(job, `   --- End of Summary LLM Response ---`);

          await logToJob(job, `   Parsing LLM response...`);
          const summary = parseLLMResponse<SummaryResult>(summaryResponse);
          await logToJob(
            job,
            `   ✓ Summary length: ${summary.overall_summary.length} characters`
          );

          // Log parsed summary result
          await logToJob(job, `   --- Parsed Summary Result ---`);
          await logToJob(job, JSON.stringify(summary, null, 2));
          await logToJob(job, `   --- End of Summary Result ---`);

          // ============================================
          // Compile Final Result
          // ============================================
          const result: any = {
            cv_match_rate: cvMatchRate,
            cv_feedback: cvEvaluation.feedback,
            cv_detailed_scores: cvResults.cv_detailed_scores,
            overall_summary: summary.overall_summary,
          };

          // Add project results if available
          if (projectResults) {
            result.project_score = projectResults.project_score;
            result.project_feedback = projectResults.project_feedback;
            // Only include detailed scores if they exist (document is relevant)
            if (projectResults.project_detailed_scores) {
              result.project_detailed_scores =
                projectResults.project_detailed_scores;
            }
          }

          // Update job status to completed
          await logToJob(job, `   Saving results to database...`);
          await JobModel.findOneAndUpdate(
            { jobId },
            {
              status: "completed",
              result,
              updatedAt: new Date(),
            }
          );

          const totalTime = Date.now() - startTime;
          await logToJob(
            job,
            `\n✅ [${new Date().toISOString()}] Job ${jobId} completed successfully`
          );
          await logToJob(
            job,
            `   Total processing time: ${totalTime}ms (${(
              totalTime / 1000
            ).toFixed(2)}s)`
          );
          await logToJob(job, `   Final Results:`);
          await logToJob(
            job,
            `      - CV Match Rate: ${cvMatchRate.toFixed(4)} (${(
              cvMatchRate * 100
            ).toFixed(2)}%)`
          );
          if (projectScore > 0) {
            await logToJob(
              job,
              `      - Project Score: ${projectScore.toFixed(2)}/5 (${(
                projectScore * 20
              ).toFixed(2)}%)`
            );
          }
          await logToJob(
            job,
            `      - Overall Summary: ${summary.overall_summary.substring(
              0,
              100
            )}...`
          );

          return result;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const totalTime = Date.now() - startTime;

          const errorLog = `\n❌ [${new Date().toISOString()}] Job ${jobId} failed after ${totalTime}ms\n   Error: ${errorMessage}`;
          console.error(errorLog);
          if (error instanceof Error && error.stack) {
            console.error(`   Stack trace:`, error.stack);
            await job.log(`   Stack trace: ${error.stack}`);
          }
          await job.log(errorLog);

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
      console.log(
        `\n✅ [${new Date().toISOString()}] Worker: Job ${job.id} completed`
      );
    });

    evaluationWorker.on("failed", (job, err) => {
      console.error(
        `\n❌ [${new Date().toISOString()}] Worker: Job ${job?.id} failed`
      );
      console.error(`   Error: ${err.message}`);
      if (err.stack) {
        console.error(`   Stack trace:`, err.stack);
      }
    });

    evaluationWorker.on("error", (err) => {
      console.error(`\n❌ [${new Date().toISOString()}] Worker error:`, err);
    });

    evaluationWorker.on("active", (job) => {
      console.log(
        `\n🔄 [${new Date().toISOString()}] Worker: Job ${
          job.id
        } started processing`
      );
    });
  }
  return evaluationWorker;
};
