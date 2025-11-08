import { Elysia } from "elysia";
import { createEvaluationHandler } from "./handlers/create.handler";
import { createEvaluationSchema } from "./schemas/evaluate.schemas";

export const evaluateController = new Elysia().post(
  "",
  async ({ body, set }) => {
    return createEvaluationHandler({
      body,
      set,
    });
  },
  createEvaluationSchema
);
