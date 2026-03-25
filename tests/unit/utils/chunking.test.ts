/**
 * Unit tests for text chunking utilities.
 * Verifies fixed-size chunking, overlap, and sliding window behaviour.
 */

import { describe, it, expect } from 'vitest';
import { fixedSizeChunk, slidingWindowChunk, semanticChunk } from '../../../src/utils/chunking';

const SHORT = 'Hello world.';
const MEDIUM = 'The quick brown fox jumps over the lazy dog. ' +
  'Pack my box with five dozen liquor jugs. ' +
  'How valiantly little Jacqueline bounces. ' +
  'The five boxing wizards jump quickly.';

describe('fixedSizeChunk', () => {
  it('returns the full text as a single chunk when shorter than chunkSize', () => {
    const chunks = fixedSizeChunk(SHORT, 100, 0);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(SHORT);
  });

  it('splits text into chunks of at most chunkSize characters', () => {
    const chunks = fixedSizeChunk(MEDIUM, 50, 0);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(50);
    }
  });

  it('includes overlap between consecutive chunks', () => {
    const text = 'abcdefghijklmnopqrstuvwxyz';
    const chunks = fixedSizeChunk(text, 10, 3);
    expect(chunks.length).toBeGreaterThan(1);
    // Second chunk should start with last 3 chars of first chunk
    const firstEnd = chunks[0]!.slice(-3);
    expect(chunks[1]!.startsWith(firstEnd)).toBe(true);
  });

  it('handles empty string', () => {
    const chunks = fixedSizeChunk('', 100, 0);
    expect(chunks).toHaveLength(0);
  });

  it('handles zero overlap', () => {
    const text = '0123456789';
    const chunks = fixedSizeChunk(text, 5, 0);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe('01234');
    expect(chunks[1]).toBe('56789');
  });
});

describe('slidingWindowChunk', () => {
  it('creates overlapping windows', () => {
    const text = 'abcdefghijklmnopqrstuvwxyz';
    const chunks = slidingWindowChunk(text, 10, 5);
    expect(chunks.length).toBeGreaterThan(1);
    // Each window should be exactly chunkSize (except possibly the last)
    for (const chunk of chunks.slice(0, -1)) {
      expect(chunk.length).toBe(10);
    }
  });

  it('returns empty array for empty input', () => {
    expect(slidingWindowChunk('', 10, 5)).toHaveLength(0);
  });
});

describe('semanticChunk', () => {
  it('splits on paragraph boundaries', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    const chunks = semanticChunk(text);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toBe('First paragraph.');
    expect(chunks[1]).toBe('Second paragraph.');
    expect(chunks[2]).toBe('Third paragraph.');
  });

  it('handles text without paragraph breaks', () => {
    const text = 'Single paragraph text with no breaks.';
    const chunks = semanticChunk(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it('filters out empty chunks', () => {
    const text = 'Para one.\n\n\n\nPara two.';
    const chunks = semanticChunk(text);
    expect(chunks).toHaveLength(2);
  });
});
