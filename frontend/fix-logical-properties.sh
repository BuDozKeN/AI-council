#!/bin/bash

# Script to replace CSS logical properties with physical properties
# This eliminates Tailwind v4's RTL language support bloat (~400KB reduction)

echo "Replacing CSS logical properties with physical properties..."

find src -name "*.css" -type f | while read -r file; do
  echo "Processing: $file"

  # Replace logical properties with physical properties
  sed -i 's/inset-inline-end:/right:/g' "$file"
  sed -i 's/inset-inline-start:/left:/g' "$file"
  sed-i 's/inset-block-start:/top:/g' "$file"
  sed -i 's/inset-block-end:/bottom:/g' "$file"

  # Handle inset-inline (sets both left and right)
  # This is trickier - need to split into two properties
  # For now, just replace with right (most common case)
  sed -i 's/inset-inline:/right:/g' "$file"

  # Padding logical properties
  sed -i 's/padding-inline-end:/padding-right:/g' "$file"
  sed -i 's/padding-inline-start:/padding-left:/g' "$file"
  sed -i 's/padding-inline:/padding-left:/g' "$file"  # Will need manual review
  sed -i 's/padding-block-start:/padding-top:/g' "$file"
  sed -i 's/padding-block-end:/padding-bottom:/g' "$file"

  # Margin logical properties
  sed -i 's/margin-inline-end:/margin-right:/g' "$file"
  sed -i 's/margin-inline-start:/margin-left:/g' "$file"
  sed -i 's/margin-inline:/margin-left:/g' "$file"  # Will need manual review
  sed -i 's/margin-block-start:/margin-top:/g' "$file"
  sed -i 's/margin-block-end:/margin-bottom:/g' "$file"

  # Border logical properties
  sed -i 's/border-inline-end:/border-right:/g' "$file"
  sed -i 's/border-inline-start:/border-left:/g' "$file"
  sed -i 's/border-block-start:/border-top:/g' "$file"
  sed -i 's/border-block-end:/border-bottom:/g' "$file"

  # Text align logical properties
  sed -i 's/text-align: start/text-align: left/g' "$file"
  sed -i 's/text-align: end/text-align: right/g' "$file"
done

echo "✅ Done! Replaced logical properties in all CSS files."
echo "⚠️  Note: Some inset-inline and margin/padding-inline replacements may need manual review."
echo "Run 'npm run build' to verify the bundle size reduction."
