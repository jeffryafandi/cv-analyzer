import { Elysia } from "elysia";
import { uploadHandler } from "./handlers/upload.handler";
import { uploadSchema } from "./schemas/upload.schemas";

export const uploadController = new Elysia().post(
  "",
  async ({ request, set }) => {
    return uploadHandler({ request, set });
  },
  uploadSchema
);
