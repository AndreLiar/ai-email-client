#!/bin/bash

# Vérifie l'argument (local ou ngrok)
if [ "$1" == "local" ]; then
  cp .env.local .env
  echo "✅ Environnement LOCAL activé."
elif [ "$1" == "ngrok" ]; then
  cp .env.ngrok .env
  echo "✅ Environnement NGROK activé."
else
  echo "❌ Usage : ./switch-env.sh [local|ngrok]"
  exit 1
fi

# Relance automatiquement le serveur Next.js
echo "🔁 Redémarrage du serveur Next.js..."
./node_modules/.bin/next dev
