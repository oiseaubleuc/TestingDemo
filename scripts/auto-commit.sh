#!/bin/bash
# Script to automatically commit changes with short messages (max 3 words)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to generate short commit message
generate_commit_msg() {
  local changed_files=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || git diff --name-only --diff-filter=ACM 2>/dev/null)
  
  if [ -z "$changed_files" ]; then
    echo "No changes detected"
    return 1
  fi
  
  # Analyze changes and generate message
  if echo "$changed_files" | grep -q "frontend/src/App.jsx\|frontend/src/App.css"; then
    echo "Update dashboard UI"
  elif echo "$changed_files" | grep -q "frontend/"; then
    echo "Update frontend code"
  elif echo "$changed_files" | grep -q "src/api/"; then
    echo "Update API server"
  elif echo "$changed_files" | grep -q "src/services/"; then
    echo "Update services"
  elif echo "$changed_files" | grep -q "\.github/workflows/"; then
    echo "Update CI pipeline"
  elif echo "$changed_files" | grep -q "package\.json"; then
    echo "Update dependencies"
  elif echo "$changed_files" | grep -q "README\|\.md"; then
    echo "Update documentation"
  else
    echo "Update project files"
  fi
}

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo -e "${RED}Error: Not a git repository${NC}"
  exit 1
fi

# Check for uncommitted changes
if [ -z "$(git status --porcelain)" ]; then
  echo -e "${YELLOW}No changes to commit${NC}"
  exit 0
fi

# Stage all changes
echo -e "${GREEN}Staging all changes...${NC}"
git add -A

# Generate commit message
COMMIT_MSG=$(generate_commit_msg)

if [ "$?" -ne 0 ] || [ -z "$COMMIT_MSG" ]; then
  echo -e "${RED}Error: Could not generate commit message${NC}"
  exit 1
fi

# Ensure max 3 words
WORD_COUNT=$(echo "$COMMIT_MSG" | wc -w | tr -d ' ')
if [ "$WORD_COUNT" -gt 3 ]; then
  COMMIT_MSG=$(echo "$COMMIT_MSG" | cut -d' ' -f1-3)
fi

echo -e "${GREEN}Committing with message: ${YELLOW}$COMMIT_MSG${NC}"

# Commit with generated message
git commit -m "$COMMIT_MSG"

echo -e "${GREEN}✅ Changes committed successfully!${NC}"
echo -e "${YELLOW}Commit message: $COMMIT_MSG${NC}"
