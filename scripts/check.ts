import {
  listCollections,
  getCollectionDocuments,
  getCollectionInfo,
} from "../src/services/ai.service";

// List all collections
const collections = await listCollections();
console.log("Available collections:", collections);

// Get info about a collection
const info = await getCollectionInfo("cv_rubric");
console.log(`Collection has ${info.count} chunks`);

// Get all documents chunk
collections.forEach(async (col, idx) => {
  const chunks = await getCollectionDocuments(col, 10);
  chunks.forEach((chunk, idx) => {
    console.log(`Chunk ${idx + 1}:`, {
      id: chunk.id,
      source: chunk.metadata?.source,
      chunk_index: chunk.metadata?.chunk_index,
      text_preview: chunk.text,
    });
  });
});
