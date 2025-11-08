import { Elysia } from "elysia";
import { createEvaluationHandler } from "./handlers/create.handler";
import { createEvaluationSchema } from "./schemas/evaluate.schemas";

export const evaluateController = new Elysia().post(
  "",
  async (context) => {
    return createEvaluationHandler({
      body: context.body as {
        vacancyId?: string;
        cvId?: string;
        reportId?: string;
      },
      set: context.set,
    });
  },
  createEvaluationSchema
);
