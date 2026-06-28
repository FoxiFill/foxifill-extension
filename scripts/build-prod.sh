#!/bin/bash

# FoxiFill Extension Production Build Script
# Production build script. Complies with Chrome Web Store policy and avoids code obfuscation.

set -e

echo "Starting FoxiFill Extension Production Build..."

# Output colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check dependencies
echo -e "${BLUE}Checking dependencies...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed${NC}"
    exit 1
fi

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
npm install

# Clean previous build output
echo -e "${BLUE}Cleaning previous build...${NC}"
rm -rf dist
rm -rf node_modules/.vite

# Create icons
echo -e "${BLUE}Creating icons...${NC}"
npm run create-icons

# TypeScript checks
echo -e "${BLUE}Type checking...${NC}"
npm run type-check

# Build project
echo -e "${BLUE}Building project...${NC}"
npm run build:prod

# Check build output
echo -e "${BLUE}Checking build results...${NC}"
if [ ! -d "dist" ]; then
    echo -e "${RED}Build failed: dist directory not found${NC}"
    exit 1
fi

# Show build information
echo -e "${GREEN}Build statistics:${NC}"
echo "Build directory: dist/"
echo "Files generated:"
find dist -type f -name "*.js" -o -name "*.html" -o -name "*.json" | sort

# Show file sizes
echo -e "${GREEN}File sizes:${NC}"
find dist -type f -name "*.js" -exec ls -lh {} \; | awk '{print $5, $9}'

# Create release package
echo -e "${BLUE}Creating release package...${NC}"
RELEASE_NAME="FoxiFill-extension-$(date +%Y%m%d-%H%M%S).zip"
cd dist
zip -r "../$RELEASE_NAME" . -x "*.backup"
cd ..

echo -e "${GREEN}Production build completed successfully.${NC}"
echo -e "${GREEN}Release package: $RELEASE_NAME${NC}"
echo -e "${YELLOW}To install the extension:${NC}"
echo "   1. Open Chrome/Edge browser"
echo "   2. Go to chrome://extensions/"
echo "   3. Enable 'Developer mode'"
echo "   4. Click 'Load unpacked'"
echo "   5. Select the 'dist' folder"
echo ""
echo -e "${YELLOW}Notes:${NC}"
echo "   - Code has been minified for production"
echo "   - Extension is ready for Google Chrome Web Store submission"
echo "   - No code obfuscation applied (complies with Google's policies)"
