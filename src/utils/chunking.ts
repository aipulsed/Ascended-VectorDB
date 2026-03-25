/**
 * Text chunking utilities for @ascendstack/vectordb.
 * Provides fixed-size sliding-window chunking for document ingestion.
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
