#!/bin/bash
# Script to setup git hooks for automatic commit messages

set -e

GIT_HOOKS_DIR=".git/hooks"
HOOKS_SOURCE_DIR=".githooks"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Setting up git hooks...${NC}"

# Create .git/hooks directory if it doesn't exist
mkdir -p "$GIT_HOOKS_DIR"

# Copy prepare-commit-msg hook
if [ -f "$HOOKS_SOURCE_DIR/prepare-commit-msg" ]; then
  cp "$HOOKS_SOURCE_DIR/prepare-commit-msg" "$GIT_HOOKS_DIR/prepare-commit-msg"
  chmod +x "$GIT_HOOKS_DIR/prepare-commit-msg"
  echo -e "${GREEN}✅ Installed prepare-commit-msg hook${NC}"
else
  echo -e "${YELLOW}⚠️  prepare-commit-msg hook not found in $HOOKS_SOURCE_DIR${NC}"
fi

echo -e "${GREEN}✅ Git hooks setup complete!${NC}"
echo -e "${YELLOW}Note: Commit messages will now be automatically limited to 3 words${NC}"
