import { readFileSync } from "fs";
import { PDFParse } from "pdf-parse";
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
    return parsed.text;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to extract text from PDF: ${errorMessage}`);
  }
}

/**
 * Chunk text into smaller pieces with overlap for better context preservation
 * @param text - Text to chunk
 * @param chunkSize - Target size of each chunk (in characters)
 * @param overlap - Number of characters to overlap between chunks
 * @returns Array of text chunks
 */
export async function chunkText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): Promise<string[]> {
  if (text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    // If not the last chunk, try to break at a sentence boundary
    if (end < text.length) {
      // Look for sentence endings within the last 100 characters
      const searchStart = Math.max(start, end - 100);
      const searchText = text.substring(searchStart, end);
      const lastPeriod = searchText.lastIndexOf(".");
      const lastNewline = searchText.lastIndexOf("\n");

      // Prefer breaking at newline, then period
      if (lastNewline > 0) {
        end = searchStart + lastNewline + 1;
      } else if (lastPeriod > 0) {
        end = searchStart + lastPeriod + 1;
      }
    }

    chunks.push(text.substring(start, end).trim());

    // Move start position with overlap
    start = end - overlap;
    if (start < 0) start = 0;
  }

  return chunks.filter((chunk) => chunk.length > 0);
}
