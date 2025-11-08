import { Elysia } from "elysia";
import { createJobVacancyHandler } from "./handlers/create.handler";
import { listJobVacanciesHandler } from "./handlers/list.handler";
import { getJobVacancyHandler } from "./handlers/get.handler";
import { updateJobVacancyHandler } from "./handlers/update.handler";
import {
  createJobVacancySchema,
  listJobVacanciesSchema,
  getJobVacancySchema,
  updateJobVacancySchema,
} from "./schemas/job-vacancy.schemas";

export const jobVacancyController = new Elysia()
  // POST /api/v1/job-vacancy - Create new job vacancy
  .post(
    "",
    async (context) => {
      return createJobVacancyHandler(context);
    },
    createJobVacancySchema
  )
  // GET /api/v1/job-vacancy - List all job vacancies
  .get(
    "",
    async (context) => {
      return listJobVacanciesHandler(context);
    },
    listJobVacanciesSchema
  )
  // GET /api/v1/job-vacancy/:id - Get specific job vacancy
  .get(
    ":id",
    async (context) => {
      return getJobVacancyHandler({ id: context.params.id, set: context.set });
    },
    getJobVacancySchema
  )
  // PATCH /api/v1/job-vacancy/:id - Update job vacancy status
  .patch(
    ":id",
    async (context) => {
      return updateJobVacancyHandler({
        id: context.params.id,
        body: context.body as { status?: "active" | "inactive" },
        set: context.set,
      });
    },
    updateJobVacancySchema
  );
