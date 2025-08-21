# Migration Supabase vers Firebase

Ce dossier contient les scripts nécessaires pour migrer vos données de Supabase vers Firebase.

## 📋 Prérequis

- Node.js installé sur votre machine
- Accès aux données Supabase (les clés sont déjà configurées dans le script d'export)
- Projet Firebase configuré (pour l'import)

## 🚀 Utilisation

### 1. Installation des dépendances

```bash
cd scripts
npm run install-deps
```

### 2. Export des données Supabase

```bash
./run-export.sh
# ou directement
npm run export
```

### 3. Import vers Firebase

**Prérequis pour l'import :**
1. Créez un projet Firebase
2. Téléchargez la clé de service account depuis Firebase Console → Project Settings → Service accounts
3. Renommez le fichier en `firebase-service-account.json` et placez-le dans ce dossier

```bash
./run-import.sh
# ou directement  
npm run import
```

## 📁 Fichiers générés

### Export Supabase
Le script créera un dossier `supabase-export/` avec les fichiers suivants :

- **albums.json** - Tous vos albums
- **day_entries.json** - Toutes les entrées de journées
- **photos.json** - Toutes les métadonnées de photos
- **storage-info.json** - Informations sur les buckets et fichiers
- **migration-report.json** - Rapport détaillé de migration

### Import Firebase
Le script d'import générera :

- **firestore.rules** - Règles de sécurité Firestore
- **storage.rules** - Règles de sécurité Storage
- **firebase-import-summary.json** - Résumé de l'import

## 🔄 Structure de données

### Albums
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "title": "string",
  "description": "string",
  "year": "number",
  "month": "number",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### Day Entries
```json
{
  "id": "uuid",
  "album_id": "uuid", 
  "user_id": "uuid",
  "date": "date",
  "title": "string",
  "description": "string",
  "latitude": "number",
  "longitude": "number",
  "location_name": "string",
  "cover_photo_id": "uuid"
}
```

### Photos
```json
{
  "id": "uuid",
  "album_id": "uuid",
  "user_id": "uuid", 
  "filename": "string",
  "file_path": "string",
  "thumbnail_path": "string",
  "mime_type": "string",
  "file_size": "number",
  "taken_at": "timestamp",
  "latitude": "number",
  "longitude": "number",
  "location_name": "string",
  "title": "string",
  "is_favorite": "boolean"
}
```

## 🔍 Rapport de migration

Le fichier `migration-report.json` contient :

- **Résumé des données** (nombre d'albums, photos, etc.)
- **Mapping Firebase** (structure des collections Firestore)
- **Relations entre les données** (albums avec leurs photos)
- **Prochaines étapes** de la migration

## ⚠️ Important

- **Gardez les fichiers exportés en sécurité** - ils contiennent toutes vos données
- **Ne commitez pas les fichiers JSON** dans votre repo Git
- **Vérifiez les données exportées** avant de procéder à l'import Firebase
- **Testez la migration** sur un environnement de développement d'abord

## 📞 Prochaines étapes

1. ✅ Export Supabase (`./run-export.sh`)
2. ✅ Script d'import Firebase (`./run-import.sh`)
3. 🔄 Configuration Firebase dans l'app React
4. 🔄 Migration du code (Auth, Firestore, Storage)
5. 🔄 Tests et validation
6. 🔄 Mise en production

---

**Notes importantes :**
- Les règles de sécurité seront générées automatiquement
- Les fichiers images doivent être migrés manuellement du storage Supabase vers Firebase Storage
- Organisez les fichiers par userId : `/photos/{userId}/` et `/thumbnails/{userId}/`
- Déployez les règles avec : `firebase deploy --only firestore:rules storage`