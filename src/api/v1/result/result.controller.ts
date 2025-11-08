import { Elysia } from "elysia";
import { getResultHandler } from "./handlers/get.handler";
import { getResultSchema } from "./schemas/result.schemas";

export const resultController = new Elysia().get(
  ":id",
  async ({ params, set }) => {
    return getResultHandler({ id: params.id, set });
  },
  getResultSchema
);
