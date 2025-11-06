import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const UPLOADS_DIR = join(process.cwd(), "uploads");

/**
 * Ensure the uploads directory exists
 */
export const ensureUploadsDir = async (): Promise<void> => {
  try {
    await mkdir(UPLOADS_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore error
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
  }
};

/**
 * Save an uploaded file to disk
 * @param file - The file to save (Bun File object)
 * @param fileType - Type of file ('cv' or 'report')
 * @returns The file path and filename
 */
export const saveFile = async (
  file: File,
  fileType: "cv" | "report"
): Promise<{ filePath: string; filename: string }> => {
  await ensureUploadsDir();

  const extension = file.name.split(".").pop() || "pdf";
  const filename = `${fileType}-${randomUUID()}.${extension}`;
  const filePath = join(UPLOADS_DIR, filename);

  const arrayBuffer = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(arrayBuffer));

  return { filePath, filename };
};

/**
 * Get the full path to a file by filename
 */
export const getFilePath = (filename: string): string => {
  return join(UPLOADS_DIR, filename);
};
