#!/bin/bash

# FoxiFill Extension Development Helper Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE} FoxiFill Extension Developer Tools${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Function to check if Node.js is installed
check_nodejs() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node --version)"
        exit 1
    fi
    
    print_status "Node.js version: $(node --version)"
}

# Function to install dependencies
install_deps() {
    print_status "Installing dependencies..."
    npm install
    print_status "Dependencies installed successfully"
}

# Function to run development server
dev_server() {
    print_status "Starting development server..."
    print_warning "Make sure to load the extension from dist/ folder in Chrome"
    npm run dev
}

# Function to build extension
build_extension() {
    print_status "Building extension for production..."
    npm run build
    print_status "Extension built successfully"
    print_status "You can find the built extension in the 'dist' folder"
}

# Function to run linting
run_lint() {
    print_status "Running ESLint..."
    npm run lint
    print_status "Linting completed"
}

# Function to run type checking
type_check() {
    print_status "Running TypeScript type checking..."
    npm run type-check
    print_status "Type checking completed"
}

# Function to clean build artifacts
clean_build() {
    print_status "Cleaning build artifacts..."
    rm -rf dist/
    rm -rf node_modules/.vite/
    print_status "Build artifacts cleaned"
}

# Function to show help
show_help() {
    print_header
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  setup     - Install dependencies and prepare development environment"
    echo "  dev       - Start development server with hot reload"
    echo "  build     - Build extension for production"
    echo "  lint      - Run ESLint code checking"
    echo "  type      - Run TypeScript type checking"
    echo "  clean     - Clean build artifacts"
    echo "  test      - Run all checks (lint + type)"
    echo "  help      - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 setup   # First time setup"
    echo "  $0 dev     # Start development"
    echo "  $0 build   # Build for production"
}

# Function to run all tests
run_tests() {
    print_status "Running all checks..."
    run_lint
    type_check
    print_status "All checks passed"
}

# Main script logic
case "$1" in
    "setup")
        print_header
        check_nodejs
        install_deps
        print_status "Setup completed! Run '$0 dev' to start development."
        ;;
    "dev")
        print_header
        check_nodejs
        dev_server
        ;;
    "build")
        print_header
        check_nodejs
        build_extension
        ;;
    "lint")
        print_header
        run_lint
        ;;
    "type")
        print_header
        type_check
        ;;
    "clean")
        print_header
        clean_build
        ;;
    "test")
        print_header
        run_tests
        ;;
    "help"|"--help"|"-h")
        show_help
        ;;
    "")
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
