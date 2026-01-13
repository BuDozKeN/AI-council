#!/usr/bin/env python3
"""
CSS Physical to Logical Properties Converter for RTL Support

Automatically converts CSS physical properties (left, right, etc.) to logical
properties (inline-start, inline-end, etc.) to enable proper RTL language support.

Usage:
    python scripts/convert_css_to_logical.py                    # Dry run (shows changes)
    python scripts/convert_css_to_logical.py --apply            # Apply changes
    python scripts/convert_css_to_logical.py --file path.css    # Convert single file

Background:
    Physical properties like 'margin-left' don't flip in RTL languages.
    Logical properties like 'margin-inline-start' automatically flip for RTL.
"""

import re
import sys
from pathlib import Path
from typing import List, Tuple


# CSS property conversion mappings
CONVERSIONS = {
    # Margin
    r'\bmargin-left\b': 'margin-inline-start',
    r'\bmargin-right\b': 'margin-inline-end',
    r'\bmargin-top\b': 'margin-block-start',
    r'\bmargin-bottom\b': 'margin-block-end',

    # Padding
    r'\bpadding-left\b': 'padding-inline-start',
    r'\bpadding-right\b': 'padding-inline-end',
    r'\bpadding-top\b': 'padding-block-start',
    r'\bpadding-bottom\b': 'padding-block-end',

    # Border
    r'\bborder-left\b': 'border-inline-start',
    r'\bborder-right\b': 'border-inline-end',
    r'\bborder-top\b': 'border-block-start',
    r'\bborder-bottom\b': 'border-block-end',

    r'\bborder-left-width\b': 'border-inline-start-width',
    r'\bborder-right-width\b': 'border-inline-end-width',
    r'\bborder-left-style\b': 'border-inline-start-style',
    r'\bborder-right-style\b': 'border-inline-end-style',
    r'\bborder-left-color\b': 'border-inline-start-color',
    r'\bborder-right-color\b': 'border-inline-end-color',

    # Border radius (special cases)
    r'\bborder-top-left-radius\b': 'border-start-start-radius',
    r'\bborder-top-right-radius\b': 'border-start-end-radius',
    r'\bborder-bottom-left-radius\b': 'border-end-start-radius',
    r'\bborder-bottom-right-radius\b': 'border-end-end-radius',

    # Position
    r'\bleft\s*:': 'inset-inline-start:',
    r'\bright\s*:': 'inset-inline-end:',
    r'\btop\s*:': 'inset-block-start:',
    r'\bbottom\s*:': 'inset-block-end:',

    # Text align
    r'\btext-align\s*:\s*left\b': 'text-align: start',
    r'\btext-align\s*:\s*right\b': 'text-align: end',

    # Float (needs manual review but auto-convert for now)
    r'\bfloat\s*:\s*left\b': 'float: inline-start',
    r'\bfloat\s*:\s*right\b': 'float: inline-end',

    # Clear
    r'\bclear\s*:\s*left\b': 'clear: inline-start',
    r'\bclear\s*:\s*right\b': 'clear: inline-end',
}


# Patterns to SKIP (these are intentionally physical and shouldn't be converted)
SKIP_PATTERNS = [
    r'transform.*translate',  # Transform functions often need physical coords
    r'@media.*max-width',     # Media queries are physical
    r'@media.*min-width',
    r'background-position',   # Background positioning is often physical
    r'clip-path',             # Clip paths use physical coordinates
    r'object-position',       # Object positioning is physical
]


def should_skip_line(line: str) -> bool:
    """Check if a line should be skipped (contains patterns that shouldn't be converted)"""
    for pattern in SKIP_PATTERNS:
        if re.search(pattern, line, re.IGNORECASE):
            return True
    return False


def convert_line(line: str) -> Tuple[str, List[str]]:
    """
    Convert a single line of CSS from physical to logical properties.

    Returns:
        Tuple of (converted_line, list of changes made)
    """
    if should_skip_line(line):
        return line, []

    original = line
    changes = []

    for pattern, replacement in CONVERSIONS.items():
        if re.search(pattern, line):
            old_prop = re.search(pattern, line).group(0)
            line = re.sub(pattern, replacement, line)
            changes.append(f"{old_prop} → {replacement}")

    return line, changes


def convert_file(file_path: Path, apply: bool = False) -> Tuple[int, List[str]]:
    """
    Convert a CSS file from physical to logical properties.

    Args:
        file_path: Path to CSS file
        apply: If True, write changes. If False, dry run.

    Returns:
        Tuple of (number of changes, list of change descriptions)
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return 0, []

    new_lines = []
    all_changes = []
    total_changes = 0

    for line_num, line in enumerate(lines, 1):
        new_line, changes = convert_line(line)
        new_lines.append(new_line)

        if changes:
            total_changes += len(changes)
            for change in changes:
                all_changes.append(f"  Line {line_num}: {change}")

    if apply and total_changes > 0:
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)
            print(f"✅ {file_path.relative_to(Path.cwd())} - {total_changes} changes applied")
        except Exception as e:
            print(f"Error writing {file_path}: {e}")
            return 0, []
    elif total_changes > 0:
        print(f"📝 {file_path.relative_to(Path.cwd())} - {total_changes} changes found (DRY RUN)")

    return total_changes, all_changes


def find_css_files(root_dir: Path) -> List[Path]:
    """Find all CSS files in the frontend directory."""
    return list(root_dir.glob('**/*.css'))


def main():
    """Main conversion script."""
    import argparse

    parser = argparse.ArgumentParser(
        description='Convert CSS physical properties to logical properties for RTL support'
    )
    parser.add_argument(
        '--apply',
        action='store_true',
        help='Apply changes (default is dry run)'
    )
    parser.add_argument(
        '--file',
        type=Path,
        help='Convert a single file instead of all CSS files'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Show detailed changes for each file'
    )

    args = parser.parse_args()

    # Determine root directory
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    frontend_dir = project_root / 'frontend' / 'src'

    if args.file:
        files = [args.file]
    else:
        files = find_css_files(frontend_dir)

    if not files:
        print("No CSS files found!")
        return

    print(f"\n{'=' * 60}")
    print(f"CSS RTL Conversion Script")
    print(f"Mode: {'APPLY CHANGES' if args.apply else 'DRY RUN (preview only)'}")
    print(f"Files to process: {len(files)}")
    print(f"{'=' * 60}\n")

    total_files_changed = 0
    total_changes = 0
    all_file_changes = {}

    for file_path in files:
        changes_count, changes_list = convert_file(file_path, apply=args.apply)

        if changes_count > 0:
            total_files_changed += 1
            total_changes += changes_count
            all_file_changes[file_path] = changes_list

            if args.verbose:
                for change in changes_list:
                    print(change)
                print()

    print(f"\n{'=' * 60}")
    print(f"Summary:")
    print(f"  Files processed: {len(files)}")
    print(f"  Files changed: {total_files_changed}")
    print(f"  Total conversions: {total_changes}")
    print(f"{'=' * 60}\n")

    if not args.apply and total_changes > 0:
        print("⚠️  This was a DRY RUN. No files were modified.")
        print("   Run with --apply to make changes:")
        print(f"   python {Path(__file__).name} --apply\n")

    if args.apply and total_changes > 0:
        print("✅ Changes have been applied!")
        print("\n📋 Next steps:")
        print("   1. Review changes with: git diff frontend/src")
        print("   2. Test the app in both LTR and RTL modes")
        print("   3. Check for any visual regressions")
        print("   4. Commit if everything looks good\n")


if __name__ == '__main__':
    main()
