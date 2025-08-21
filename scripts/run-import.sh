#!/bin/bash

echo "🔥 Import des données vers Firebase"
echo "=================================="

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Installez-le depuis https://nodejs.org/"
    exit 1
fi

# Vérifier si les dépendances sont installées
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm run install-deps
fi

# Vérifier si le fichier de service account existe
if [ ! -f "firebase-service-account.json" ]; then
    echo "❌ Fichier firebase-service-account.json non trouvé!"
    echo ""
    echo "📋 Suivez ces étapes:"
    echo "1. Allez dans la console Firebase"
    echo "2. Projet Settings > Service accounts"
    echo "3. Générez une nouvelle clé privée"
    echo "4. Téléchargez le fichier JSON et renommez-le 'firebase-service-account.json'"
    echo "5. Placez-le dans le dossier scripts/"
    exit 1
fi

# Vérifier si les données exportées existent
if [ ! -d "supabase-export" ]; then
    echo "❌ Dossier supabase-export non trouvé!"
    echo "Exécutez d'abord le script d'export: ./run-export.sh"
    exit 1
fi

echo "🚀 Démarrage de l'import..."
node import-to-firebase.js

echo ""
echo "✅ Script d'import terminé!"