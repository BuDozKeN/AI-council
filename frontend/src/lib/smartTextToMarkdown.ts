/**
 * Smart Text to Markdown Converter
 *
 * Automatically detects plain text patterns and converts them to proper Markdown.
 * Handles:
 * - Tables (tab/multi-space separated columns)
 * - Numbered sections (1. Title, 2. Title)
 * - Code blocks (lines with { } ; = or indented code patterns)
 * - Bullet points (lines starting with - or *)
 * - Headers (ALL CAPS lines, or lines ending with :)
 */

// Minimum lines required to wrap in code block
const MIN_CODE_LINES_FOR_BLOCK = 3;

/**
 * Detect if content is already Markdown (has MD syntax)
 */
function isAlreadyMarkdown(text: string): boolean {
  if (!text) return false;

  // Check for common Markdown patterns
  const mdPatterns = [
    /^#{1,6}\s/m, // Headers: # ## ###
    /^\*\*[^*]+\*\*/m, // Bold: **text**
    /^```/m, // Code blocks: ```
    /^\|.+\|$/m, // Tables: | col | col |
    /^\s*[-*]\s+\S/m, // Lists: - item or * item
    /\[.+\]\(.+\)/, // Links: [text](url)
  ];

  return mdPatterns.some((pattern) => pattern.test(text));
}

/**
 * Detect if a group of lines looks like a table
 * (consistent column structure with tabs or multiple spaces)
 */
function detectTable(lines: string[]): boolean {
  if (lines.length < 2) return false;

  // Check if lines have consistent tab/multi-space separators
  const columnCounts = lines.map((line) => {
    // Split by tabs or 2+ spaces
    const cols = line.split(/\t|  +/).filter((c) => c.trim());
    return cols.length;
  });

  // All rows should have same column count (2+ columns)
  const firstCount = columnCounts[0] ?? 0;
  return firstCount >= 2 && columnCounts.every((c) => c === firstCount || c === 0);
}

/**
 * Convert table lines to Markdown table
 */
function convertToMarkdownTable(lines: string[]): string {
  const rows = lines
    .map((line) => {
      const cols = line.split(/\t|  +/).filter((c) => c.trim());
      return cols;
    })
    .filter((row) => row.length > 0);

  if (rows.length === 0) return '';

  const firstRow = rows[0];
  if (!firstRow) return '';
  const colCount = firstRow.length;

  // Build markdown table
  let md = '';

  // Header row
  md += '| ' + firstRow.join(' | ') + ' |\n';

  // Separator row
  md += '|' + firstRow.map(() => '---').join('|') + '|\n';

  // Data rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    // Pad row if needed
    while (row.length < colCount) row.push('');
    md += '| ' + row.join(' | ') + ' |\n';
  }

  return md;
}

interface HeaderResult {
  level: number;
  text: string;
}

/**
 * Detect if line is a section header
 */
function isHeader(line: string, nextLine: string | undefined): HeaderResult | false {
  if (!line.trim()) return false;

  // Numbered section: "1. Something" or "1. Something"
  if (/^\d+\.\s+[A-Z]/.test(line)) return { level: 2, text: line.replace(/^\d+\.\s+/, '') };

  // ALL CAPS line (short, likely a header)
  if (/^[A-Z][A-Z\s\-_&]+$/.test(line.trim()) && line.trim().length < 50) {
    return { level: 2, text: line.trim() };
  }

  // Line ending with colon followed by content (subheader)
  if (/^[A-Z][^:]+:$/.test(line.trim()) && line.trim().length < 60) {
    return { level: 3, text: line.trim().replace(/:$/, '') };
  }

  // Title case line alone (likely header)
  if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(line.trim()) && line.trim().length < 50) {
    // Check if next line is empty or different structure
    if (!nextLine || nextLine.trim() === '' || /^\d|^[A-Z]{2,}|^\s{2,}/.test(nextLine)) {
      return { level: 2, text: line.trim() };
    }
  }

  return false;
}

/**
 * Detect if line is code - DISABLED
 *
 * Code detection was causing too many false positives with documentation
 * that contains code examples inline. Users can manually wrap code in ```
 * if needed. The smart formatter now focuses on:
 * - Tables (tab-separated → markdown tables)
 * - Headers (ALL CAPS, numbered sections, title case)
 * - Lists (bullet points, checkboxes)
 */
function isCodeLine(_line: string): boolean {
  // Disabled - too many false positives
  return false;
}

/**
 * Main conversion function
 */
export function smartTextToMarkdown(text: string | null | undefined, forceConvert = false): string {
  if (!text || typeof text !== 'string') return text || '';

  // If already has Markdown, return as-is (unless forceConvert is true)
  if (!forceConvert && isAlreadyMarkdown(text)) return text;

  const lines = text.split('\n');
  const result = [];
  let i = 0;
  let inCodeBlock = false;
  let codeBlockLines = [];

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const nextLine = lines[i + 1];
    const trimmed = line.trim();

    // Skip empty lines (preserve them)
    if (!trimmed) {
      // End code block if we were in one
      if (inCodeBlock && codeBlockLines.length > 0) {
        result.push('```');
        result.push(...codeBlockLines);
        result.push('```');
        codeBlockLines = [];
        inCodeBlock = false;
      }
      result.push('');
      i++;
      continue;
    }

    // Check for code lines - only collect, don't output yet
    if (isCodeLine(line)) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLines = [];
      }
      codeBlockLines.push(line);
      i++;
      continue;
    } else if (inCodeBlock && codeBlockLines.length > 0) {
      // End code block - only wrap if we have enough lines
      if (codeBlockLines.length >= MIN_CODE_LINES_FOR_BLOCK) {
        result.push('```');
        result.push(...codeBlockLines);
        result.push('```');
      } else {
        // Not enough lines - just output as regular text
        result.push(...codeBlockLines);
      }
      codeBlockLines = [];
      inCodeBlock = false;
    }

    // Check for headers
    const header = isHeader(line, nextLine);
    if (header) {
      const prefix = '#'.repeat(header.level);
      result.push(`${prefix} ${header.text}`);
      i++;
      continue;
    }

    // Check for table start
    // Look ahead to see if next few lines form a table
    const tableLines: string[] = [];
    let j = i;
    while (j < lines.length && lines[j]?.trim()) {
      const currentLine = lines[j] ?? '';
      const cols = currentLine.split(/\t|  +/).filter((c) => c.trim());
      if (cols.length >= 2) {
        tableLines.push(currentLine);
        j++;
      } else {
        break;
      }
    }

    if (tableLines.length >= 2 && detectTable(tableLines)) {
      result.push(convertToMarkdownTable(tableLines));
      i = j;
      continue;
    }

    // Check for bullet points (lines starting with - or *)
    if (/^[-*]\s+/.test(trimmed)) {
      result.push(line);
      i++;
      continue;
    }

    // Check for checkbox items
    if (/^[[\]xX\s]+\s+/.test(trimmed)) {
      const checked = /^\[x\]/i.test(trimmed);
      const itemText = trimmed.replace(/^[[\]xX\s]+\s+/, '');
      result.push(checked ? `- [x] ${itemText}` : `- [ ] ${itemText}`);
      i++;
      continue;
    }

    // Default: treat as paragraph
    result.push(line);
    i++;
  }

  // Close any remaining code block - only wrap if enough lines
  if (inCodeBlock && codeBlockLines.length > 0) {
    if (codeBlockLines.length >= MIN_CODE_LINES_FOR_BLOCK) {
      result.push('```');
      result.push(...codeBlockLines);
      result.push('```');
    } else {
      // Not enough lines - just output as regular text
      result.push(...codeBlockLines);
    }
  }

  return result.join('\n');
}

export { isAlreadyMarkdown };
export default smartTextToMarkdown;
