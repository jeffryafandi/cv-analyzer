import { Elysia } from "elysia";

export const evaluateController = new Elysia({ prefix: "/evaluate" }).post(
  "/",
  async ({ body }) => {
    // TODO: Handle evaluation job creation
    // Creates MongoDB document and adds job to BullMQ queue
    // Returns job ID and status
    return {
      success: true,
      message: "Evaluate endpoint - implementation pending",
      jobId: null,
      status: "pending",
    };
  },
  {
    detail: {
      summary: "Create Evaluation Job",
      description:
        "Creates an evaluation job, stores it in MongoDB, and adds it to the BullMQ queue. Returns job ID and status.",
      tags: ["Evaluate"],
    },
  }
);
