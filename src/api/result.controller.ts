import { Elysia } from "elysia";

export const resultController = new Elysia({ prefix: "/result" }).get(
  "/:id",
  async ({ params }) => {
    // TODO: Retrieve evaluation job results from MongoDB
    // Returns job status and results
    return {
      success: true,
      message: "Result endpoint - implementation pending",
      jobId: params.id,
      status: "pending",
      results: null,
    };
  },
  {
    detail: {
      summary: "Get Evaluation Result",
      description:
        "Retrieves evaluation job results from MongoDB. Returns job status and results.",
      tags: ["Result"],
    },
  }
);
