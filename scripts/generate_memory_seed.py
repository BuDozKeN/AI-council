import os
import sys
from pathlib import Path

# Configuration
PROJECT_ROOT = Path(__file__).parent.parent
OUTPUT_FILE = PROJECT_ROOT / "docs" / "MEMORY_SEED.txt"

# Files that define the "Big Picture" of the architecture
CRITICAL_FILES = [
    "README.md",
    "pyproject.toml",
    "backend/main.py",
    "backend/council.py",
    "backend/database.py",
    "backend/migrations/01_organization_schema.sql",
    "frontend/package.json",
    "frontend/src/App.jsx",
    "frontend/src/api.js",
]

def get_tree(path, prefix=""):
    """Generates a simple directory tree string."""
    output = ""
    try:
        # Sort directories first, then files
        items = sorted(os.listdir(path))
        items = [i for i in items if i not in [".git", "__pycache__", "node_modules", ".venv", "venv", "dist", "build", ".next"]]
        
        for i, item in enumerate(items):
            is_last = i == len(items) - 1
            connector = "└── " if is_last else "├── "
            
            full_path = os.path.join(path, item)
            output += f"{prefix}{connector}{item}\n"
            
            if os.path.isdir(full_path):
                extension = "    " if is_last else "│   "
                output += get_tree(full_path, prefix + extension)
    except PermissionError:
        pass
    return output

def generate_seed():
    """Generates the memory seed content."""
    content = []
    content.append("# Project Architecture Memory Seed")
    content.append("Analyze this project structure and core files to establish a persistent memory of the architecture.\n")
    
    content.append("## 1. Directory Structure")
    content.append("```")
    content.append(get_tree(PROJECT_ROOT))
    content.append("```\n")
    
    content.append("## 2. Critical File Contents")
    
    for rel_path in CRITICAL_FILES:
        file_path = PROJECT_ROOT / rel_path
        if file_path.exists():
            content.append(f"\n### File: {rel_path}")
            content.append(f"```{file_path.suffix[1:]}")
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content.append(f.read())
            except Exception as e:
                content.append(f"Error reading file: {e}")
            content.append("```")
        else:
            content.append(f"\n### File: {rel_path} (Not Found)")

    return "\n".join(content)

if __name__ == "__main__":
    print(f"Generating memory seed to {OUTPUT_FILE}...")
    os.makedirs(OUTPUT_FILE.parent, exist_ok=True)
    
    seed_content = generate_seed()
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(seed_content)
        
    print("Done!")
    print(f"ACTION REQUIRED: Run 'claude' in your terminal and paste the contents of {OUTPUT_FILE} with the prompt:")
    print('"Analyze this project context and store it in your memory for future sessions."')
