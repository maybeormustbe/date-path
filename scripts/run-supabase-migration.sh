#!/bin/bash

echo "🔄 Migration Supabase vers Supabase"
echo "==================================="

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Installez-le depuis https://nodejs.org/"
    exit 1
fi

# Aller dans le dossier scripts
cd "$(dirname "$0")"

# Installer les dépendances si nécessaire
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install @supabase/supabase-js
fi

# Vérifier si le fichier de config existe
if [ ! -f "config.json" ]; then
    echo "❌ Fichier config.json non trouvé!"
    echo ""
    echo "📋 Suivez ces étapes:"
    echo "1. Copiez config.json vers votre propre fichier de config"
    echo "2. Remplissez les URLs et clés API des deux instances Supabase"
    echo "3. Adaptez la liste des tables et buckets à migrer"
    echo ""
    echo "🔑 Vous aurez besoin de:"
    echo "- URL de l'instance source"
    echo "- Clé anon + service_role de l'instance source"
    echo "- URL de l'instance destination" 
    echo "- Clé anon + service_role de l'instance destination"
    exit 1
fi

# Demander quelle action effectuer
echo "Que voulez-vous faire ?"
echo "1) Export des données depuis l'instance source"
echo "2) Import des données vers l'instance destination"
echo "3) Migration complète (export puis import)"
read -p "Votre choix (1/2/3): " choice

case $choice in
    1)
        echo "🚀 Démarrage de l'export..."
        node supabase-to-supabase.js export
        ;;
    2)
        echo "🚀 Démarrage de l'import..."
        node supabase-to-supabase.js import
        ;;
    3)
        echo "🚀 Démarrage de la migration complète..."
        node supabase-to-supabase.js export
        if [ $? -eq 0 ]; then
            echo ""
            echo "🔄 Export terminé, démarrage de l'import..."
            node supabase-to-supabase.js import
        else
            echo "❌ L'export a échoué, import annulé"
            exit 1
        fi
        ;;
    *)
        echo "❌ Choix invalide"
        exit 1
        ;;
esac

echo ""
echo "✅ Opération terminée!"