/**
 * Text chunking utilities for @ascendstack/vectordb.
 * Provides fixed-size, sliding-window, and semantic chunking strategies
 * for document ingestion pipelines.
 */

/**
 * Splits text into fixed-size chunks with optional overlap.
 * Uses character-level splitting; for token-level splitting, integrate a tokenizer.
 *
 * @param text     - The source text to split.
 * @param size     - Maximum characters per chunk.
 * @param overlap  - Number of characters to overlap between consecutive chunks.
 * @returns        Array of text chunk strings.
 */
export function fixedSizeChunk(text: string, size: number, overlap: number): string[] {
  if (size <= 0) throw new Error('Chunk size must be greater than 0');
  if (overlap < 0 || overlap >= size) throw new Error('Overlap must be >= 0 and < size');

  const chunks: string[] = [];
  const step = size - overlap;
  for (let i = 0; i < text.length; i += step) {
    chunks.push(text.slice(i, i + size));
    if (i + size >= text.length) break;
  }
  return chunks;
}

/**
 * Splits text into fixed-size windows advancing by a configurable step.
 *
 * @param text      - The source text to split.
 * @param chunkSize - Number of characters per window.
 * @param step      - Number of characters to advance between windows.
 * @returns         Array of text chunk strings.
 */
export function slidingWindowChunk(text: string, chunkSize: number, step: number): string[] {
  if (!text) return [];
  if (chunkSize <= 0) throw new Error('Chunk size must be greater than 0');
  if (step <= 0) throw new Error('Step must be greater than 0');

  const chunks: string[] = [];
  let i = 0;
  while (i + chunkSize <= text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += step;
  }
  // Emit one final partial chunk for any remaining characters
  if (i < text.length) {
    chunks.push(text.slice(i));
  }
  return chunks;
}

/**
 * Splits text on paragraph boundaries (two or more consecutive newlines),
 * filtering out empty segments.
 *
 * @param text - The source text to split.
 * @returns    Array of non-empty paragraph strings, trimmed of surrounding whitespace.
 */
export function semanticChunk(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
}
