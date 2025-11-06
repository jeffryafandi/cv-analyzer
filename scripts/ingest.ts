import { ChromaClient } from "chromadb";
import { readdirSync, statSync } from "fs";
import { join } from "path";
import { extractTextFromPDF, chunkText } from "../src/services/pdf.service";
import { env } from "../src/config/env";

// Collection name mappings
const COLLECTION_MAPPINGS: Record<string, string> = {
  cv_rubric: "cv_rubric",
  cv_scoring_rubric: "cv_rubric",
  "cv-rubric": "cv_rubric",
  job_description: "job_description",
  "job-description": "job_description",
  project_rubric: "project_rubric",
  project_scoring_rubric: "project_rubric",
  "project-rubric": "project_rubric",
  case_study_brief: "case_study_brief",
  "case-study-brief": "case_study_brief",
  case_study: "case_study_brief",
};

/**
 * Detect collection name from filename
 */
function detectCollectionName(filename: string): string | null {
  const nameWithoutExt = filename
    .replace(/\.pdf$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");

  // Check exact matches first
  if (COLLECTION_MAPPINGS[nameWithoutExt]) {
    return COLLECTION_MAPPINGS[nameWithoutExt];
  }

  // Check partial matches
  for (const [key, collection] of Object.entries(COLLECTION_MAPPINGS)) {
    if (nameWithoutExt.includes(key) || key.includes(nameWithoutExt)) {
      return collection;
    }
  }

  return null;
}

/**
 * Ingest a single PDF file into ChromaDB
 */
async function ingestPDF(
  client: ChromaClient,
  filePath: string,
  filename: string
): Promise<void> {
  const collectionName = detectCollectionName(filename);

  if (!collectionName) {
    console.warn(
      `⚠️  Skipping ${filename}: Could not determine collection name. Expected patterns: cv_rubric, job_description, project_rubric, case_study_brief`
    );
    return;
  }

  console.log(`📄 Processing ${filename} → ${collectionName} collection`);

  try {
    // Extract text from PDF
    const text = await extractTextFromPDF(filePath);
    if (!text || text.trim().length === 0) {
      console.warn(`⚠️  ${filename} appears to be empty or unreadable`);
      return;
    }

    // Chunk the text
    const chunks = await chunkText(text, 1000, 200);
    console.log(`   Split into ${chunks.length} chunks`);

    // Get or create collection
    const collection = await client.getOrCreateCollection({
      name: collectionName,
    });

    // Prepare documents, metadatas, and IDs
    const documents: string[] = [];
    const metadatas: Array<Record<string, string | number | boolean | null>> =
      [];
    const ids: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkId = `${filename}_chunk_${i}`;

      documents.push(chunk);
      metadatas.push({
        source: filename,
        chunk_index: i,
        total_chunks: chunks.length,
      });
      ids.push(chunkId);
    }

    // Add to collection
    await collection.add({
      ids,
      documents,
      metadatas,
    });

    console.log(
      `✅ Successfully ingested ${chunks.length} chunks from ${filename}`
    );
  } catch (error) {
    console.error(`❌ Error ingesting ${filename}:`, error);
    throw error;
  }
}

/**
 * Main ingestion function
 */
async function main() {
  console.log("🚀 Starting ChromaDB ingestion...");
  console.log(`📁 Data directory: ${join(process.cwd(), "data")}`);
  console.log(`🔗 ChromaDB URL: ${env.CHROMA_URL}\n`);

  // Initialize ChromaDB client
  // ChromaDB v3.x accepts host and port directly, or a full URL string
  const url = new URL(env.CHROMA_URL);
  const client = new ChromaClient({
    host: url.hostname,
    port: url.port ? parseInt(url.port) : 8000,
  });

  // Check if ChromaDB is accessible
  try {
    await client.heartbeat();
    console.log("✅ ChromaDB connection successful\n");
  } catch (error) {
    console.error(
      "❌ Failed to connect to ChromaDB. Make sure it's running at",
      env.CHROMA_URL
    );
    process.exit(1);
  }

  // Read data directory
  const dataDir = join(process.cwd(), "data");
  let files: string[];

  try {
    files = readdirSync(dataDir);
  } catch (error) {
    console.error(`❌ Failed to read data directory: ${error}`);
    process.exit(1);
  }

  // Filter PDF files
  const pdfFiles = files.filter(
    (file) => file.toLowerCase().endsWith(".pdf") && file !== ".gitkeep"
  );

  if (pdfFiles.length === 0) {
    console.warn(
      "⚠️  No PDF files found in data directory. Please add PDFs with names matching:"
    );
    console.warn("   - cv_rubric.pdf or cv_scoring_rubric.pdf");
    console.warn("   - job_description.pdf");
    console.warn("   - project_rubric.pdf or project_scoring_rubric.pdf");
    console.warn("   - case_study_brief.pdf");
    process.exit(0);
  }

  console.log(`Found ${pdfFiles.length} PDF file(s) to ingest:\n`);

  // Process each PDF
  for (const filename of pdfFiles) {
    const filePath = join(dataDir, filename);
    const stats = statSync(filePath);

    if (!stats.isFile()) {
      console.warn(`⚠️  Skipping ${filename}: Not a file`);
      continue;
    }

    await ingestPDF(client, filePath, filename);
    console.log();
  }

  console.log("✨ Ingestion complete!");
}

// Run the script
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
