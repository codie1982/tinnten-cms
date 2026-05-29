#!/usr/bin/env bash
# cms-reset.sh — node_modules temizle, bağımlılıkları kur, 5020 portunu boşalt, CMS başlat

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=5020

echo "📁  Proje: $PROJECT_DIR"
cd "$PROJECT_DIR"

# ── 1. Temizlik ──────────────────────────────────────────────────────────────
echo "🗑️   node_modules siliniyor..."
sudo rm -rf node_modules

# ── 2. Bağımlılıkları kur ────────────────────────────────────────────────────
echo "📦  npm install..."
npm install

# ── 3. Port 5020'yi boşalt ───────────────────────────────────────────────────
echo "🔌  Port $PORT kontrol ediliyor..."
PIDS=$(lsof -ti tcp:$PORT 2>/dev/null || true)
if [ -n "$PIDS" ]; then
  echo "⚡  Port $PORT'daki process(ler) kapatılıyor: $PIDS"
  echo "$PIDS" | xargs kill -9
  sleep 1
else
  echo "✅  Port $PORT boş."
fi

# ── 4. CMS başlat ────────────────────────────────────────────────────────────
echo "🚀  npm run dev başlatılıyor (port $PORT)..."
npm run dev -- -p $PORT
