import { diffWords } from 'diff';

export interface DiffPart {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}

/**
 * Compute an inline diff between two strings.
 * Returns an array of parts with type 'added', 'removed', or 'unchanged'.
 *
 * @param oldText - The original text
 * @param newText - The proposed new text
 * @returns Array of diff parts with type and value
 */
export function computeInlineDiff(oldText: string, newText: string): DiffPart[] {
  if (!oldText && !newText) {
    return [];
  }

  // If no old text, everything is added
  if (!oldText) {
    return [{ type: 'added', value: newText }];
  }

  // If no new text, everything is removed
  if (!newText) {
    return [{ type: 'removed', value: oldText }];
  }

  const diff = diffWords(oldText, newText);

  return diff.map(part => ({
    type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
    value: part.value
  }));
}

/**
 * Check if there are actual changes between old and new text.
 * @param oldText - The original text
 * @param newText - The proposed new text
 * @returns true if there are changes, false otherwise
 */
export function hasChanges(oldText: string, newText: string): boolean {
  if (!oldText && !newText) return false;
  if (!oldText || !newText) return true;

  // Normalize whitespace for comparison
  const normalizedOld = oldText.trim().replace(/\s+/g, ' ');
  const normalizedNew = newText.trim().replace(/\s+/g, ' ');

  return normalizedOld !== normalizedNew;
}
