#!/bin/bash

echo "🚀 MIGRATION SUPABASE COMPLÈTE"
echo "==============================="
echo ""

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

# Menu principal
echo "Que voulez-vous faire ?"
echo ""
echo "1) 🏗️  Créer la structure de données (tables, RLS, buckets, fonctions...)"
echo "2) 📦 Migrer les données (export + import)"
echo "3) 📤 Export uniquement"
echo "4) 📥 Import uniquement" 
echo "5) 🔄 Migration complète (structure + données)"
echo ""
read -p "Votre choix (1/2/3/4/5): " choice

case $choice in
    1)
        echo ""
        echo "🏗️ Création de la structure de données..."
        echo "⚠️  ATTENTION: Ceci va créer/modifier la structure de votre base de destination"
        read -p "Êtes-vous sûr ? (y/N): " confirm
        if [[ $confirm =~ ^[Yy]$ ]]; then
            node supabase-migration.js structure
        else
            echo "Opération annulée"
        fi
        ;;
    2)
        echo ""
        echo "📦 Migration des données (export + import)..."
        node supabase-migration.js migrate
        ;;
    3)
        echo ""
        echo "📤 Export des données..."
        node supabase-migration.js export
        ;;
    4)
        echo ""
        echo "📥 Import des données..."
        echo "⚠️  ATTENTION: Assurez-vous que la structure existe dans la destination"
        read -p "Continuer ? (y/N): " confirm
        if [[ $confirm =~ ^[Yy]$ ]]; then
            node supabase-migration.js import
        else
            echo "Opération annulée"
        fi
        ;;
    5)
        echo ""
        echo "🔄 Migration complète (structure + données)..."
        echo "⚠️  ATTENTION: Ceci va créer la structure ET migrer toutes les données"
        read -p "Êtes-vous sûr ? (y/N): " confirm
        if [[ $confirm =~ ^[Yy]$ ]]; then
            echo ""
            echo "🏗️ Étape 1/2: Création de la structure..."
            node supabase-migration.js structure
            if [ $? -eq 0 ]; then
                echo ""
                echo "📦 Étape 2/2: Migration des données..."
                node supabase-migration.js migrate
            else
                echo "❌ Erreur lors de la création de la structure, migration annulée"
                exit 1
            fi
        else
            echo "Opération annulée"
        fi
        ;;
    *)
        echo "❌ Choix invalide"
        exit 1
        ;;
esac

echo ""
echo "✅ Opération terminée!"
echo ""
echo "📋 Prochaines étapes recommandées:"
echo "1. Vérifiez que tout s'est bien passé dans votre interface Supabase"
echo "2. Testez votre application avec la nouvelle base"
echo "3. Si vous avez migré des utilisateurs, ils doivent réinitialiser leur mot de passe"
echo "4. Les fichiers de storage doivent être migrés manuellement"