#!/usr/bin/env node

const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');

// Configuration Firebase
let serviceAccount;
try {
  serviceAccount = require('./firebase-service-account.json');
} catch (error) {
  console.error('❌ Fichier firebase-service-account.json non trouvé!');
  console.log('📋 Suivez ces étapes:');
  console.log('1. Allez dans la console Firebase');
  console.log('2. Projet Settings > Service accounts');
  console.log('3. Générez une nouvelle clé privée');
  console.log('4. Téléchargez le fichier JSON dans scripts/firebase-service-account.json');
  process.exit(1);
}

// Initialisez Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function importCollection(collectionName, data, mapping = {}) {
  try {
    console.log(`📊 Import de ${collectionName}...`);
    
    const batch = db.batch();
    let count = 0;
    
    for (const item of data) {
      // Mapper les champs si nécessaire
      const mappedItem = { ...item };
      Object.keys(mapping).forEach(oldKey => {
        if (mappedItem[oldKey] !== undefined) {
          mappedItem[mapping[oldKey]] = mappedItem[oldKey];
          delete mappedItem[oldKey];
        }
      });
      
      // Convertir les timestamps
      if (mappedItem.created_at) {
        mappedItem.createdAt = admin.firestore.Timestamp.fromDate(new Date(mappedItem.created_at));
        delete mappedItem.created_at;
      }
      if (mappedItem.updated_at) {
        mappedItem.updatedAt = admin.firestore.Timestamp.fromDate(new Date(mappedItem.updated_at));
        delete mappedItem.updated_at;
      }
      if (mappedItem.taken_at && mappedItem.taken_at !== null) {
        mappedItem.takenAt = admin.firestore.Timestamp.fromDate(new Date(mappedItem.taken_at));
        delete mappedItem.taken_at;
      }
      
      // Mapper les IDs spécifiques
      if (mappedItem.album_id) {
        mappedItem.albumId = mappedItem.album_id;
        delete mappedItem.album_id;
      }
      if (mappedItem.user_id) {
        mappedItem.userId = mappedItem.user_id;
        delete mappedItem.user_id;
      }
      if (mappedItem.cover_photo_id) {
        mappedItem.coverPhotoId = mappedItem.cover_photo_id;
        delete mappedItem.cover_photo_id;
      }
      if (mappedItem.file_path) {
        mappedItem.filePath = mappedItem.file_path;
        delete mappedItem.file_path;
      }
      if (mappedItem.file_size) {
        mappedItem.fileSize = mappedItem.file_size;
        delete mappedItem.file_size;
      }
      if (mappedItem.mime_type) {
        mappedItem.mimeType = mappedItem.mime_type;
        delete mappedItem.mime_type;
      }
      if (mappedItem.thumbnail_path) {
        mappedItem.thumbnailPath = mappedItem.thumbnail_path;
        delete mappedItem.thumbnail_path;
      }
      if (mappedItem.location_name) {
        mappedItem.locationName = mappedItem.location_name;
        delete mappedItem.location_name;
      }
      if (mappedItem.is_favorite !== undefined) {
        mappedItem.isFavorite = mappedItem.is_favorite;
        delete mappedItem.is_favorite;
      }
      
      const docRef = db.collection(collectionName).doc(mappedItem.id);
      batch.set(docRef, mappedItem);
      count++;
      
      // Commit par batch de 500 (limite Firestore)
      if (count % 500 === 0) {
        await batch.commit();
        console.log(`  ✅ ${count} documents importés...`);
      }
    }
    
    // Commit le reste
    if (count % 500 !== 0) {
      await batch.commit();
    }
    
    console.log(`✅ ${collectionName}: ${count} documents importés avec succès`);
    return count;
  } catch (error) {
    console.error(`❌ Erreur lors de l'import de ${collectionName}:`, error);
    throw error;
  }
}

async function createFirestoreRules() {
  const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Albums: seuls les propriétaires peuvent voir/modifier leurs albums
    match /albums/{albumId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
    }
    
    // Day entries: seuls les propriétaires peuvent voir/modifier leurs entrées
    match /dayEntries/{dayId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
    }
    
    // Photos: seuls les propriétaires peuvent voir/modifier leurs photos
    match /photos/{photoId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
    }
    
    // Profiles: les utilisateurs peuvent créer/modifier leur propre profil
    match /profiles/{userId} {
      allow read, write: if request.auth != null && userId == request.auth.uid;
    }
  }
}`;

  const rulesPath = path.join(__dirname, 'firestore.rules');
  await fs.writeFile(rulesPath, rules);
  
  console.log('📄 Règles Firestore générées dans firestore.rules');
  console.log('📋 Pour déployer les règles:');
  console.log('   firebase deploy --only firestore:rules');
}

async function createStorageRules() {
  const rules = `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Photos: seuls les propriétaires peuvent voir/modifier leurs fichiers
    match /photos/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Thumbnails: seuls les propriétaires peuvent voir/modifier leurs miniatures
    match /thumbnails/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}`;

  const rulesPath = path.join(__dirname, 'storage.rules');
  await fs.writeFile(rulesPath, rules);
  
  console.log('📄 Règles Storage générées dans storage.rules');
  console.log('📋 Pour déployer les règles:');
  console.log('   firebase deploy --only storage');
}

async function generateMigrationSummary(exportDir, albumsCount, dayEntriesCount, photosCount) {
  const summary = {
    importDate: new Date().toISOString(),
    firestoreCollections: {
      albums: albumsCount,
      dayEntries: dayEntriesCount,
      photos: photosCount
    },
    nextSteps: [
      "1. Déployer les règles Firestore: firebase deploy --only firestore:rules",
      "2. Déployer les règles Storage: firebase deploy --only storage", 
      "3. Migrer les fichiers du storage Supabase vers Firebase Storage",
      "4. Configurer Firebase Auth dans votre application",
      "5. Remplacer les appels Supabase par Firebase dans le code",
      "6. Tester l'application avec Firebase",
      "7. Supprimer les données Supabase après validation"
    ],
    storageInfo: {
      message: "Les fichiers doivent être migrés manuellement du storage Supabase vers Firebase Storage",
      structure: "Organisez les fichiers par userId: /photos/{userId}/ et /thumbnails/{userId}/"
    }
  };

  const filePath = path.join(exportDir, 'firebase-import-summary.json');
  await fs.writeFile(filePath, JSON.stringify(summary, null, 2));
  
  return summary;
}

async function main() {
  try {
    console.log('🚀 Début de l\'import vers Firebase...\n');
    
    const exportDir = path.join(__dirname, 'supabase-export');
    
    // Vérifier que les fichiers d'export existent
    const albumsPath = path.join(exportDir, 'albums.json');
    const dayEntriesPath = path.join(exportDir, 'day_entries.json');
    const photosPath = path.join(exportDir, 'photos.json');
    
    console.log('📂 Lecture des données exportées...');
    const albums = JSON.parse(await fs.readFile(albumsPath, 'utf8'));
    const dayEntries = JSON.parse(await fs.readFile(dayEntriesPath, 'utf8'));
    const photos = JSON.parse(await fs.readFile(photosPath, 'utf8'));
    
    console.log(`📊 Données à importer:`);
    console.log(`   Albums: ${albums.length}`);
    console.log(`   Day Entries: ${dayEntries.length}`);
    console.log(`   Photos: ${photos.length}\n`);
    
    // Import des collections
    const albumsCount = await importCollection('albums', albums);
    const dayEntriesCount = await importCollection('dayEntries', dayEntries);
    const photosCount = await importCollection('photos', photos);
    
    // Générer les règles de sécurité
    await createFirestoreRules();
    await createStorageRules();
    
    // Générer le résumé
    await generateMigrationSummary(exportDir, albumsCount, dayEntriesCount, photosCount);
    
    console.log('\n🎉 Import terminé avec succès!');
    console.log('\n📋 ÉTAPES SUIVANTES:');
    console.log('1. Déployez les règles: firebase deploy --only firestore:rules storage');
    console.log('2. Migrez manuellement les fichiers du storage');
    console.log('3. Mettez à jour le code de votre application');
    
    console.log('\n📄 Fichiers générés:');
    console.log('- firestore.rules (règles de sécurité Firestore)');
    console.log('- storage.rules (règles de sécurité Storage)');
    console.log('- supabase-export/firebase-import-summary.json');
    
  } catch (error) {
    console.error('\n❌ Erreur lors de l\'import:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Exécuter le script si appelé directement
if (require.main === module) {
  main();
}

module.exports = { main };