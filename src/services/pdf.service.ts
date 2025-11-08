import { readFileSync } from "fs";
import { PDFParse } from "pdf-parse";

/**
 * Clean text by removing non-normal characters and symbols
 * Keeps: letters, numbers, common punctuation, and whitespace
 * @param text - Text to clean
 * @returns Cleaned text
 */
function cleanText(text: string): string {
  // Keep: letters, numbers, common punctuation, whitespace, and some useful symbols
  // Allowed: a-z, A-Z, 0-9, . , ! ? : ; - ( ) [ ] { } " ' @ # $ % & * + = / \ | ~ ` ^ < > and whitespace
  return text
    .replace(/[^\w\s.,!?:;\-()[\]{}"'@#$%&*+=/\\|~`^<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract text content from a PDF file
 * @param filePath - Path to the PDF file
 * @returns Extracted text as a string
 */
export async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    const dataBuffer = readFileSync(filePath);
    const pdfParse = new PDFParse({ data: dataBuffer });
    const parsed = await pdfParse.getText();
    // Clean the extracted text
    return cleanText(parsed.text);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to extract text from PDF: ${errorMessage}`);
  }
}

/**
 * Extract text from PDF preserving line breaks for markdown formatting
 * @param filePath - Path to the PDF file
 * @returns Extracted text with line breaks preserved
 */
export async function extractTextFromPDFWithLineBreaks(
  filePath: string
): Promise<string> {
  try {
    const dataBuffer = readFileSync(filePath);
    const pdfParse = new PDFParse({ data: dataBuffer });
    const parsed = await pdfParse.getText();
    // Return raw text with line breaks preserved
    return parsed.text;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to extract text from PDF: ${errorMessage}`);
  }
}

/**
 * Clean and format PDF content for markdown display
 * - Removes page markers like "-- 1 of 2 --"
 * - Filters out unrelated symbols outside of normal characters
 * - Preserves line breaks and formatting
 * - Normalizes whitespace appropriately
 * @param content - Raw PDF text content
 * @returns Formatted content ready for markdown display
 */
export function formatPDFContentForMarkdown(content: string): string {
  // Remove page markers (e.g., "-- 1 of 2 --", "-- 2 of 2 --", "-- 1 of 1 --")
  let cleaned = content.replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "");

  // Remove standalone page markers (e.g., "1 of 2", "2 of 2")
  cleaned = cleaned.replace(/\b\d+\s+of\s+\d+\b/gi, "");

  // Use the same filtering approach as cleanText
  // Keep: letters, numbers, common punctuation, whitespace, and some useful symbols
  // Allowed: a-z, A-Z, 0-9, . , ! ? : ; - ( ) [ ] { } " ' @ # $ % & * + = / \ | ~ ` ^ < > and whitespace
  // Replace unwanted characters with spaces (preserving newlines for markdown)
  cleaned = cleaned.replace(/[^\w\s.,!?:;\-()[\]{}"'@#$%&*+=/\\|~`^<>]/g, " ");

  // Process line by line to preserve line breaks for markdown
  cleaned = cleaned
    .split("\n")
    .map((line) => {
      // Normalize multiple spaces/tabs to single space on each line
      return line.replace(/\s+/g, " ").trim();
    })
    .filter((line) => line.length > 0)
    .join("\n");

  // Normalize multiple line breaks (keep max 2 consecutive line breaks)
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Remove leading/trailing whitespace
  return cleaned.trim();
}

/**
 * Extract and format PDF content for markdown display in one step
 * @param filePath - Path to the PDF file
 * @returns Formatted content ready for markdown display
 */
export async function extractAndFormatPDFForMarkdown(
  filePath: string
): Promise<string> {
  const rawContent = await extractTextFromPDFWithLineBreaks(filePath);
  return formatPDFContentForMarkdown(rawContent);
}

/**
 * Split text into sentences (ending with periods, exclamation marks, or question marks)
 * @param text - Text to split
 * @returns Array of sentences
 */
function splitIntoSentences(text: string): string[] {
  // Normalize whitespace first
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return [];
  }

  const sentences: string[] = [];
  // Split by sentence endings: period, exclamation, or question mark followed by space or end of string
  // This regex matches: . ! or ? followed by whitespace or end of string
  const sentenceRegex = /[.!?]+(?=\s|$)/g;
  let lastIndex = 0;
  let match;

  while ((match = sentenceRegex.exec(normalized)) !== null) {
    // Include the sentence ending punctuation
    const sentenceEnd = match.index + match[0].length;
    const sentence = normalized.substring(lastIndex, sentenceEnd).trim();

    if (sentence.length > 0) {
      sentences.push(sentence);
    }
    lastIndex = sentenceEnd;

    // Skip whitespace after sentence ending
    while (lastIndex < normalized.length && normalized[lastIndex] === " ") {
      lastIndex++;
    }
  }

  // Add remaining text as last sentence if any (if text doesn't end with punctuation)
  if (lastIndex < normalized.length) {
    const remaining = normalized.substring(lastIndex).trim();
    if (remaining.length > 0) {
      // If it doesn't end with punctuation, add it anyway (might be incomplete sentence)
      sentences.push(remaining);
    }
  }

  // If no sentences found, return the whole text as a single sentence
  return sentences.length > 0 ? sentences : [normalized];
}

/**
 * Chunk text into smaller pieces by sentences with overlap for better context preservation
 * Each chunk will end with a complete sentence (ending with . ! or ?)
 * @param text - Text to chunk
 * @param chunkSize - Target size of each chunk (in characters)
 * @param overlap - Number of sentences to overlap between chunks
 * @returns Array of text chunks (each ending with sentence punctuation)
 */
export async function chunkText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 2
): Promise<string[]> {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Split text into sentences (each ending with . ! or ?)
  const sentences = splitIntoSentences(text);

  if (sentences.length === 0) {
    return [text];
  }

  // If all sentences fit in one chunk, return as is
  const totalLength = sentences.reduce((sum, s) => sum + s.length + 1, 0) - 1; // +1 for spaces, -1 for last space
  if (totalLength <= chunkSize) {
    return [sentences.join(" ").trim()];
  }

  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;
  let sentenceIndex = 0;

  while (sentenceIndex < sentences.length) {
    const sentence = sentences[sentenceIndex];
    const sentenceLength = sentence.length + (currentChunk.length > 0 ? 1 : 0); // +1 for space if not first sentence

    // If adding this sentence would exceed chunk size and we have content, finalize chunk
    if (currentLength + sentenceLength > chunkSize && currentChunk.length > 0) {
      // Join sentences and ensure it ends with sentence punctuation
      const chunkText = currentChunk.join(" ").trim();
      chunks.push(chunkText);

      // Start new chunk with overlap sentences from previous chunk
      if (overlap > 0 && currentChunk.length > 0) {
        const overlapStart = Math.max(0, currentChunk.length - overlap);
        currentChunk = currentChunk.slice(overlapStart);
        // Recalculate length for overlap sentences
        currentLength = currentChunk.reduce((sum, s, idx) => {
          return sum + s.length + (idx > 0 ? 1 : 0);
        }, 0);
      } else {
        currentChunk = [];
        currentLength = 0;
      }
    }

    // Add sentence to current chunk
    currentChunk.push(sentence);
    currentLength += sentenceLength;
    sentenceIndex++;
  }

  // Add remaining chunk if any (ensuring it ends with sentence punctuation)
  if (currentChunk.length > 0) {
    const chunkText = currentChunk.join(" ").trim();
    chunks.push(chunkText);
  }

  // Filter out empty chunks and ensure each chunk ends with sentence punctuation
  return chunks
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => {
      // Ensure chunk ends with sentence punctuation, if not add period
      if (!/[.!?]$/.test(chunk.trim())) {
        return chunk.trim() + ".";
      }
      return chunk.trim();
    });
}
