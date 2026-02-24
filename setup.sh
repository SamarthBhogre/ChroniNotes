#!/usr/bin/env bash
# ── ChroniNotes Setup Script (Linux/macOS) ──
# Installs all dependencies and verifies prerequisites

set -e

echo ""
echo "========================================"
echo "   ChroniNotes Setup"
echo "========================================"
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js not found!"
    echo "Install it from https://nodejs.org/"
    exit 1
fi
echo "[OK] $(node -v)"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "[ERROR] npm not found!"
    echo "It should come with Node.js. Try reinstalling Node."
    exit 1
fi
echo "[OK] npm $(npm -v)"

# Check for Rust
if ! command -v rustc &> /dev/null; then
    echo "[ERROR] Rust not found!"
    echo "Install it from https://rustup.rs/"
    exit 1
fi
echo "[OK] $(rustc --version)"

# Check for Cargo
if ! command -v cargo &> /dev/null; then
    echo "[ERROR] Cargo not found!"
    echo "Install Rust via https://rustup.rs/"
    exit 1
fi
echo "[OK] $(cargo --version)"

echo ""
echo "── Installing root dependencies..."
npm install

echo ""
echo "── Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo ""
echo "========================================"
echo "   Setup complete!"
echo "========================================"
echo ""
echo "Run the app:"
echo "  npm run dev"
echo ""
echo "Build for production:"
echo "  npm run build"
echo ""
