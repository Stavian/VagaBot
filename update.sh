#!/bin/bash
set -e

echo "=== VagaBot Update ==="

echo "[1/3] Pulling latest code..."
git pull origin main

echo "[2/3] Installing dependencies..."
npm install --production

echo "[3/3] Restarting bot..."
npm run pm2:restart

echo ""
echo "=== Done! Bot is running with latest changes ==="
npm run pm2:status
