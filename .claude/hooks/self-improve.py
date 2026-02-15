#!/usr/bin/env python3
"""Self-improvement hook: after complex turns (8+ tool calls), suggest one optimization."""
import sys
import json
import os


def is_real_user_message(entry):
    """Check if a transcript entry is a real user prompt (not a tool_result relay)."""
    if entry.get("role") not in ("user", "human"):
        return False
    content = entry.get("content", "")
    if isinstance(content, str) and content.strip():
        return True
    if isinstance(content, list):
        return any(
            isinstance(c, dict) and c.get("type") == "text" and c.get("text", "").strip()
            for c in content
        )
    return False


def count_tool_calls(transcript_path):
    """Count tool_use blocks in the last assistant turn."""
    try:
        with open(transcript_path, "r") as f:
            lines = f.readlines()
    except (OSError, IOError):
        return 0

    tool_count = 0
    found_assistant = False

    for line in reversed(lines):
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue

        role = entry.get("role", "")

        if role == "assistant":
            found_assistant = True
            content = entry.get("content", [])
            if isinstance(content, list):
                tool_count += sum(
                    1 for c in content
                    if isinstance(c, dict) and c.get("type") == "tool_use"
                )
        elif found_assistant and is_real_user_message(entry):
            break

    return tool_count


def is_exploratory(prompt):
    """Check if the prompt is exploratory (questions, short queries)."""
    words = prompt.split()
    if len(words) < 3:
        return True
    first = words[0].lower().rstrip("?,!:")
    starters = {
        "what", "how", "why", "where", "when", "who",
        "explain", "describe", "show", "tell", "list",
    }
    return first in starters


def main():
    try:
        data = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, EOFError, ValueError):
        return

    prompt = data.get("prompt", "")
    transcript_path = data.get("transcript_path", "")

    if is_exploratory(prompt):
        return

    if not transcript_path or not os.path.exists(transcript_path):
        return

    tool_count = count_tool_calls(transcript_path)

    if tool_count >= 8:
        print(
            "After completing the user's request, append one brief optimization hint "
            "— suggest a reusable skill, memory pattern, or workflow improvement "
            "based on this session's complexity. One sentence only."
        )


if __name__ == "__main__":
    main()
