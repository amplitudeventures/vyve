/**
 * Utility functions for handling logs
 */

const MAX_LOG_LENGTH = 500; // Maximum length for truncated logs
const TRUNCATION_MARKER = '... [truncated]';

/**
 * Truncates a string to a maximum length while preserving readability
 */
export function truncateLog(content: string | undefined | null, maxLength: number = MAX_LOG_LENGTH): string {
  if (!content) return '';
  
  if (content.length <= maxLength) return content;
  
  // For objects/arrays that were stringified
  if (content.startsWith('{') || content.startsWith('[')) {
    try {
      const obj = JSON.parse(content);
      return JSON.stringify(obj, null, 2).substring(0, maxLength) + TRUNCATION_MARKER;
    } catch {
      // If parsing fails, treat as regular string
    }
  }
  
  // For regular strings, try to break at a word boundary
  const truncated = content.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) { // Only break at word if it's not too far back
    return truncated.substring(0, lastSpace) + TRUNCATION_MARKER;
  }
  
  return truncated + TRUNCATION_MARKER;
}

/**
 * Formats a log object with truncated values
 */
export function formatLogObject(obj: Record<string, any>): Record<string, any> {
  const formatted: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      formatted[key] = truncateLog(value);
    } else if (value && typeof value === 'object') {
      formatted[key] = formatLogObject(value);
    } else {
      formatted[key] = value;
    }
  }
  
  return formatted;
} 