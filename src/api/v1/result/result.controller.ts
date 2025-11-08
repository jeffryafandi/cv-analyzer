import { Elysia } from "elysia";
import { getResultHandler } from "./handlers/get.handler";
import { getResultSchema } from "./schemas/result.schemas";

export const resultController = new Elysia().get(
  ":id",
  async (context) => {
    return getResultHandler({ id: context.params.id, set: context.set });
  },
  getResultSchema
);
