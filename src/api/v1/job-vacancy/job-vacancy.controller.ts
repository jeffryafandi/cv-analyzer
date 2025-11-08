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
    async ({ request, set }) => {
      return createJobVacancyHandler({ request, set });
    },
    createJobVacancySchema
  )
  // GET /api/v1/job-vacancy - List all job vacancies
  .get(
    "",
    async ({ query, set }) => {
      return listJobVacanciesHandler({ query, set });
    },
    listJobVacanciesSchema
  )
  // GET /api/v1/job-vacancy/:id - Get specific job vacancy
  .get(
    ":id",
    async ({ params, set }) => {
      return getJobVacancyHandler({ id: params.id, set });
    },
    getJobVacancySchema
  )
  // PATCH /api/v1/job-vacancy/:id - Update job vacancy status
  .patch(
    ":id",
    async ({ params, body, set }) => {
      return updateJobVacancyHandler({
        id: params.id,
        body,
        set,
      });
    },
    updateJobVacancySchema
  );
