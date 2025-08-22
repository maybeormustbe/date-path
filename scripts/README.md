# Scripts de Migration Supabase

Ce dossier contient les scripts pour migrer des données entre instances Supabase ou vers Firebase.

## 🔄 Migration Supabase vers Supabase

### Démarrage rapide
```bash
cd scripts
chmod +x run-supabase-migration.sh
./run-supabase-migration.sh
```

### Configuration
1. Copiez `config.json` et remplissez vos informations :
```json
{
  "source": {
    "url": "https://your-source-project.supabase.co",
    "anon_key": "your-source-anon-key",
    "service_role_key": "your-source-service-role-key"
  },
  "destination": {
    "url": "https://your-destination-project.supabase.co", 
    "anon_key": "your-destination-anon-key",
    "service_role_key": "your-destination-service-role-key"
  },
  "tables": ["albums", "day_entries", "photos"],
  "storage_buckets": ["photos", "thumbnails"],
  "export_users": true
}
```

### Commandes manuelles
```bash
# Export seulement
node supabase-to-supabase.js export

# Import seulement  
node supabase-to-supabase.js import
```

### ⚠️ Points importants
- **Utilisateurs** : Mot de passe temporaire, réinitialisation requise
- **Storage** : Seules les métadonnées sont exportées, pas les fichiers
- **Service Role Key** : Requis pour l'export/import des utilisateurs
- **Ordre d'import** : Utilisateurs d'abord, puis tables

## 🔥 Migration Supabase vers Firebase

### Export des données Supabase
```bash
chmod +x run-export.sh
./run-export.sh
```

### Import vers Firebase
```bash
chmod +x run-import.sh  
./run-import.sh
```

### Configuration Firebase
1. Console Firebase → Project Settings → Service accounts
2. Generate new private key → `firebase-service-account.json`
3. Placez le fichier dans `scripts/`

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