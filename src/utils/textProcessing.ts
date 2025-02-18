import { get_encoding } from 'tiktoken';

export class TextProcessing {
  private static readonly ENCODING = "cl100k_base";
  private static readonly MAX_TOKENS = 1000;
  private static readonly MIN_TOKENS = 50;

  static countTokens(text: string): number {
    const encoding = get_encoding(this.ENCODING);
    const tokens = encoding.encode(text);
    const count = tokens.length;
    encoding.free(); // Clean up to prevent memory leaks
    return count;
  }

  static chunkText(text: string): string[] {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid input: text must be a non-empty string');
    }

    // Clean and normalize text
    const cleanedText = text
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
      .replace(/\s+/g, ' ')                  // Normalize whitespace
      .trim();

    if (cleanedText.length === 0) {
      throw new Error('Text is empty after cleaning');
    }

    // Split text into sentences while preserving important whitespace
    const sentences = cleanedText
      .split(/([.!?]+[\s\n]+)/)
      .filter(Boolean)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const chunks: string[] = [];
    let currentChunk = '';
    const encoding = get_encoding(this.ENCODING);

    try {
      for (const sentence of sentences) {
        const potentialChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
        const tokens = encoding.encode(potentialChunk);

        if (tokens.length <= this.MAX_TOKENS) {
          currentChunk = potentialChunk;
        } else {
          if (currentChunk) {
            chunks.push(currentChunk);
          }
          // If the sentence itself is too long, split it further
          if (encoding.encode(sentence).length > this.MAX_TOKENS) {
            const words = sentence.split(/\s+/);
            let subChunk = '';
            
            for (const word of words) {
              const potentialSubChunk = subChunk ? `${subChunk} ${word}` : word;
              if (encoding.encode(potentialSubChunk).length <= this.MAX_TOKENS) {
                subChunk = potentialSubChunk;
              } else {
                if (subChunk) {
                  chunks.push(subChunk);
                }
                subChunk = word;
              }
            }
            if (subChunk) {
              currentChunk = subChunk;
            }
          } else {
            currentChunk = sentence;
          }
        }
      }

      // Add the last chunk if it exists and meets minimum size
      if (currentChunk && encoding.encode(currentChunk).length >= this.MIN_TOKENS) {
        chunks.push(currentChunk);
      }

      return chunks;
    } finally {
      encoding.free(); // Clean up to prevent memory leaks
    }
  }
}