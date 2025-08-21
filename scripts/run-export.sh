#!/bin/bash

echo "🚀 Script d'export Supabase vers Firebase"
echo "========================================"

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

# Aller dans le dossier scripts
cd "$(dirname "$0")"

# Installer les dépendances si nécessaire
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install @supabase/supabase-js
fi

# Exécuter l'export
echo "🔄 Lancement de l'export..."
node export-supabase-data.js

echo "✅ Export terminé ! Vérifiez le dossier supabase-export/"