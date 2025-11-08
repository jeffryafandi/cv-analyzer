import { Elysia } from "elysia";
import { readdir, stat } from "fs/promises";
import { join } from "path";

/**
 * Auto-loads all controllers from the v1 directory structure
 * Each folder in v1 becomes a route prefix: /api/v1/{folderName}
 * Controllers should be named: {folderName}.controller.ts
 *
 * Controllers should export an Elysia instance WITHOUT a prefix (the loader applies it)
 * or export a function that returns an Elysia instance
 */
export async function loadControllers(): Promise<Elysia> {
  const app = new Elysia();
  const v1Path = join(import.meta.dir, "v1");
  const loadedControllers: string[] = [];
  const failedControllers: string[] = [];

  try {
    // Read all directories in v1
    const entries = await readdir(v1Path, { withFileTypes: true });
    const directories = entries.filter((entry) => entry.isDirectory());

    // Load each controller
    for (const dir of directories) {
      const folderName = dir.name;
      const controllerFileName = `${folderName}.controller.ts`;
      const controllerPath = join(v1Path, folderName, controllerFileName);

      try {
        // Check if controller file exists
        const stats = await stat(controllerPath);
        if (!stats.isFile()) {
          console.warn(
            `⚠️  Controller file not found: ${controllerPath}, skipping...`
          );
          continue;
        }

        // Use relative import path from this file
        const relativePath = `./v1/${folderName}/${controllerFileName}`;
        const controllerModule = await import(relativePath);

        // Convert kebab-case folder name to camelCase for controller name
        // e.g., "job-vacancy" -> "jobVacancy"
        const camelCaseName = folderName
          .split("-")
          .map((part, index) =>
            index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
          )
          .join("");
        const controllerName = `${camelCaseName}Controller`;

        // Look for exported controller (try multiple patterns)
        let controller =
          controllerModule[controllerName] ||
          controllerModule.default ||
          controllerModule.controller;

        // If controller is a function, call it
        if (typeof controller === "function") {
          controller = controller();
        }

        if (!controller) {
          const errorMsg = `No controller exported from ${controllerPath}. Expected export: ${controllerName}, default, or controller`;
          console.warn(`⚠️  ${errorMsg}, skipping...`);
          failedControllers.push(folderName);
          continue;
        }

        // Validate that controller is an Elysia instance
        if (!(controller instanceof Elysia)) {
          const errorMsg = `Controller from ${controllerPath} is not an Elysia instance`;
          console.error(`❌ ${errorMsg}, skipping...`);
          failedControllers.push(folderName);
          continue;
        }

        // Automatically apply prefix based on folder name
        // This eliminates the need for controllers to define their own prefix
        const prefix = `/api/v1/${folderName}`;
        app.group(prefix, (app) => app.use(controller));
        loadedControllers.push(folderName);
        console.log(`✅ Loaded controller: ${prefix}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(
          `❌ Error loading controller from ${controllerPath}:`,
          errorMsg
        );
        failedControllers.push(folderName);
      }
    }

    // Summary
    console.log(
      `\n📦 Controller Loading Summary: ${loadedControllers.length} loaded, ${failedControllers.length} failed`
    );
    if (failedControllers.length > 0) {
      console.warn(`⚠️  Failed controllers: ${failedControllers.join(", ")}`);
    }
  } catch (error) {
    console.error(`❌ Error reading v1 directory:`, error);
  }

  return app;
}
