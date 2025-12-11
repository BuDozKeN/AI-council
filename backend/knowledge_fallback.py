"""
Knowledge Fallback Module

Deterministic fallback extraction when AI fails (e.g., 429 rate limits).
Always returns clean, readable, bullet-pointed text. Never garbage.

This module sanitizes text by removing:
- SQL keywords and statements
- Code patterns (function definitions, imports, etc.)
- Code blocks (fenced and inline)
- System prompt artifacts
"""

import re
from typing import Optional

MAX_FIELD_CHARS = 600

# SQL patterns to filter out - these should never appear in user-facing text
SQL_KEYWORDS = [
    "CREATE TABLE", "ALTER TABLE", "ADD COLUMN", "DROP COLUMN",
    "PRIMARY KEY", "FOREIGN KEY", "INSERT INTO", "UPDATE ", "DELETE FROM",
    "DEFAULT ", " TEXT", " INTEGER", " BOOLEAN", " VARCHAR", "NOT NULL",
    "REFERENCES ", "ON DELETE", "ON UPDATE", "CREATE INDEX", "DROP INDEX",
    "SELECT ", "FROM ", "WHERE ", "JOIN ", "LEFT JOIN", "RIGHT JOIN",
    "GROUP BY", "ORDER BY", "HAVING", "LIMIT ", "OFFSET ",
]

# Code patterns that indicate programming content
CODE_PATTERNS = [
    "def ", "class ", "import ", "from ", "=>", "function ",
    "if (", "elif ", "else:", "console.log", "return ", "//", "#include",
    "async ", "await ", "const ", "let ", "var ", "export ", "module.",
    "require(", "useState", "useEffect", ".then(", ".catch(",
    "try:", "except:", "raise ", "throw ", "catch (", "finally:",
    "for (", "while (", "switch (", "case ", "break;",
    "null", "undefined", "None", "True", "False",
    "```", "===", "!==", "&&", "||",
]


def _strip_code_blocks(text: str) -> str:
    """Remove fenced code blocks and inline code."""
    if not text:
        return ""
    # Remove fenced code blocks (```...```)
    text = re.sub(r"```[\s\S]*?```", "", text)
    # Remove inline code (`...`)
    text = re.sub(r"`[^`]+`", "", text)
    return text


def _remove_code_lines(text: str) -> str:
    """Filter out lines that look like code or SQL."""
    if not text:
        return ""
    lines = text.splitlines()
    clean = []
    for line in lines:
        line_stripped = line.strip()
        if not line_stripped:
            continue

        # Check for SQL keywords (case insensitive)
        upper = line_stripped.upper()
        if any(k in upper for k in SQL_KEYWORDS):
            continue

        # Check for code patterns (case sensitive for most)
        if any(p in line_stripped for p in CODE_PATTERNS):
            continue

        # Skip lines that look like JSON keys or object properties
        if re.match(r'^[\"\']?\w+[\"\']?\s*:\s*', line_stripped):
            # But allow natural language sentences that happen to have colons
            if len(line_stripped) < 50 or line_stripped.count(':') > 1:
                continue

        # Skip lines with too many special characters (likely code)
        special_char_ratio = len(re.findall(r'[{}\[\]();=<>]', line_stripped)) / max(len(line_stripped), 1)
        if special_char_ratio > 0.1:
            continue

        clean.append(line_stripped)

    return " ".join(clean)


def _clean_text(text: str) -> str:
    """Full cleaning pipeline."""
    if not text:
        return ""

    text = _strip_code_blocks(text)
    text = _remove_code_lines(text)

    # Clean up markdown formatting
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)  # Bold
    text = re.sub(r'\*([^*]+)\*', r'\1', text)      # Italic
    text = re.sub(r'__([^_]+)__', r'\1', text)      # Bold (underscore)
    text = re.sub(r'_([^_]+)_', r'\1', text)        # Italic (underscore)
    text = re.sub(r'^#+\s*', '', text, flags=re.MULTILINE)  # Headers

    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()

    return text[:MAX_FIELD_CHARS]


def _to_bullets(text: str, max_bullets: int = 4) -> str:
    """Convert text to bullet points."""
    cleaned = _clean_text(text)
    if not cleaned:
        return "• No content available"

    # Split into sentences
    sentences = re.split(r'(?<=[.!?])\s+', cleaned)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 20]

    # If no good sentences, try splitting by commas or semicolons
    if not sentences:
        sentences = re.split(r'[,;]\s+', cleaned)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 15]

    # Deduplicate similar sentences
    bullets = []
    seen = set()
    for s in sentences:
        # Create a simple key for deduplication
        key = s[:30].lower().strip()
        if key not in seen and len(s) < 200:
            seen.add(key)
            # Clean up the sentence
            s = s.strip()
            if not s.endswith(('.', '!', '?')):
                s = s.rstrip(',;:') + '.'
            bullets.append(f"• {s}")
        if len(bullets) >= max_bullets:
            break

    if bullets:
        return "\n".join(bullets)

    # Last resort: just truncate the cleaned text
    return f"• {cleaned[:150]}..."


def _short_title(text: str, max_words: int = 8) -> str:
    """Generate a short title from text."""
    cleaned = _clean_text(text)
    if not cleaned:
        return "Council Discussion"

    # Try to find a question or key phrase
    # Remove question words for cleaner titles
    cleaned = re.sub(r'^(how|what|why|when|where|who|can|should|would|could|is|are|do|does)\s+', '', cleaned, flags=re.IGNORECASE)

    words = cleaned.split()[:max_words]
    title = " ".join(words)

    # Capitalize first letter
    if title:
        title = title[0].upper() + title[1:]

    # Add ellipsis if truncated
    if len(cleaned.split()) > max_words:
        title = title.rstrip('.,;:!?') + "..."

    return title if title else "Council Discussion"


def _context_summary(text: str, max_chars: int = 200) -> str:
    """Generate a clean context summary as prose (not bullets)."""
    cleaned = _clean_text(text)
    if not cleaned:
        return "A question was discussed by the AI council."

    # Truncate to max chars at word boundary
    if len(cleaned) > max_chars:
        truncated = cleaned[:max_chars]
        # Find last space to avoid cutting mid-word
        last_space = truncated.rfind(' ')
        if last_space > max_chars // 2:
            truncated = truncated[:last_space]
        cleaned = truncated.rstrip('.,;:!?') + "..."

    # Ensure it starts with capital
    if cleaned:
        cleaned = cleaned[0].upper() + cleaned[1:]

    return cleaned


def extract_knowledge_fallback(
    original_question: str,
    chairman_answer: str = "",
    conversation_title: Optional[str] = None
) -> dict:
    """
    Deterministic fallback when AI extraction fails.
    Always returns readable, bullet-pointed text. Never garbage.

    Args:
        original_question: The user's original question
        chairman_answer: The Stage 3 chairman synthesis (optional)
        conversation_title: Existing conversation title if available

    Returns:
        dict with title, problem_statement, decision_text, reasoning, category
    """
    # Use conversation title if it's good, otherwise generate from question
    if conversation_title and len(conversation_title) > 10 and conversation_title != "New Conversation":
        title = conversation_title
    else:
        title = _short_title(original_question)

    # Build problem statement from the question
    problem = _to_bullets(original_question, max_bullets=4)

    # Build decision from chairman's answer
    # Note: In fallback mode, we only populate decision - not reasoning
    # because we can't reliably extract different content for both fields
    if chairman_answer and len(chairman_answer.strip()) > 50:
        decision = _to_bullets(chairman_answer, max_bullets=4)
        reasoning = ""  # Leave empty - user can add if needed
    else:
        decision = "• Review full conversation for decision details"
        reasoning = ""  # Leave empty - user can add if needed

    # Try to detect category from content
    category = _detect_category(original_question + " " + chairman_answer)

    # Generate a clean context summary from the original question
    context_summary = _context_summary(original_question)

    return {
        "title": title,
        "context_summary": context_summary,
        "problem_statement": problem,
        "decision_text": decision,
        "reasoning": reasoning,
        "category": category,
        "department": "general",
        "used_ai": False
    }


def _detect_category(text: str) -> str:
    """Simple keyword-based category detection."""
    text_lower = text.lower()

    # Technical indicators
    if any(kw in text_lower for kw in ['api', 'database', 'code', 'server', 'deploy', 'bug', 'feature', 'implement']):
        return "technical_decision"

    # UX/Design indicators
    if any(kw in text_lower for kw in ['design', 'user experience', 'ux', 'ui', 'interface', 'layout', 'button', 'modal']):
        return "ux_pattern"

    # Process indicators
    if any(kw in text_lower for kw in ['process', 'workflow', 'procedure', 'step', 'guideline', 'standard']):
        return "process"

    # Policy indicators
    if any(kw in text_lower for kw in ['policy', 'rule', 'compliance', 'security', 'privacy', 'legal']):
        return "policy"

    # Feature indicators
    if any(kw in text_lower for kw in ['feature', 'functionality', 'capability', 'add', 'new']):
        return "feature"

    return "general"


def extract_project_fallback(
    original_question: str,
    chairman_answer: str = "",
    conversation_title: Optional[str] = None
) -> dict:
    """
    Deterministic fallback for project extraction when AI fails.

    Args:
        original_question: The user's original question
        chairman_answer: The Stage 3 chairman synthesis (optional)
        conversation_title: Existing conversation title if available

    Returns:
        dict with name and description
    """
    # Generate a project name
    if conversation_title and len(conversation_title) > 10 and conversation_title != "New Conversation":
        name = conversation_title
    else:
        name = _short_title(original_question, max_words=5)

    # Build description with bullet points
    problem_bullets = _to_bullets(original_question, max_bullets=3)

    if chairman_answer and len(chairman_answer.strip()) > 50:
        goal_bullets = _to_bullets(chairman_answer, max_bullets=3)
        description = f"A project to address the following:\n\n{problem_bullets}\n\nKey Goals:\n{goal_bullets}"
    else:
        description = f"A project created from council discussion.\n\nContext:\n{problem_bullets}\n\nUse this project to track related decisions and progress."

    return {
        "name": name,
        "description": description,
        "used_ai": False
    }
