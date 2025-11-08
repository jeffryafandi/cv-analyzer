import { Elysia } from "elysia";
import { connectDB } from "./config/db";
import { connectRedis } from "./config/redis";
import { env } from "./config/env";
import { loadControllers } from "./api/load-controllers";
import { swaggerPlugin } from "./swagger";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ElysiaAdapter } from "@bull-board/elysia";
import { getEvaluationQueue } from "./jobs/evaluation.queue";
import { getJobVacancyIngestionQueue } from "./jobs/job-vacancy-ingestion.queue";
import packageJson from "../package.json";
import { httpErrors } from "./api/http-error";

// Create server adapter first
const serverAdapter = new ElysiaAdapter("/admin/queues");

// Function to initialize the app after Redis is connected
async function startServer() {
  // Connect to MongoDB and Redis first
  await Promise.all([connectDB(), connectRedis()]);

  // Setup Bull Board after Redis is connected
  createBullBoard({
    queues: [
      new BullMQAdapter(getEvaluationQueue()),
      new BullMQAdapter(getJobVacancyIngestionQueue()),
    ],
    serverAdapter,

    options: {
      uiBasePath: "node_modules/@bull-board/ui",
    },
  });

  // Load all controllers automatically
  const controllersApp = await loadControllers();

  // Initialize Elysia app
  const app = new Elysia()
    .get(
      "/",
      () =>
        new Response(
          `
     <html>
     <body>
     <h1>CV Analyzer API v${packageJson.version}</h1>
     </body>
     </html>`,
          {
            headers: {
              "Content-Type": "text/html",
            },
          }
        )
    )
    .use(controllersApp)
    .use(swaggerPlugin)
    .onBeforeHandle(({ request, set, path }) => {
      // Only apply authentication to bull-board routes
      if (path.startsWith("/admin/queues")) {
        const authHeader = request.headers.get("authorization");
        if (!authHeader) {
          set.headers["WWW-Authenticate"] = 'Basic realm="Restricted Area"';
          set.status = 401;
          return "Authentication required.";
        }
        const base64Credentials = authHeader.split(" ")[1];
        const credentials = Buffer.from(base64Credentials, "base64").toString(
          "ascii"
        );
        const [username, password] = credentials.split(":");
        if (
          username !== env.BULL_BOARD_USERNAME ||
          password !== env.BULL_BOARD_PASSWORD
        ) {
          set.headers["WWW-Authenticate"] = 'Basic realm="Restricted Area"';
          set.status = 401;
          return "Invalid credentials.";
        }
      }
    })
    .use(serverAdapter.registerPlugin())
    .onError(({ code, error }) => {
      // Ignore 404 errors
      if (code === "NOT_FOUND") {
        return httpErrors.notFound(
          error instanceof Error ? error.message : String(error) || "Not found"
        );
      }
      // Handle other errors
      console.error(`Error: ${code}`, error);
      return httpErrors.internalServerError(
        error instanceof Error
          ? error.message
          : String(error) || "Internal server error"
      );
    });

  app.listen(env.PORT, () => {
    console.log(`🦊 Elysia is running at http://localhost:${env.PORT}`);
    console.log(
      `📚 API Documentation available at http://localhost:${env.PORT}/api-docs`
    );
    console.log(
      `📊 Bull Board available at http://localhost:${env.PORT}/admin/queues`
    );
  });
}

// Start the server
startServer().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});
