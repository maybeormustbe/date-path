#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

// Configuration Supabase
const SUPABASE_URL = 'https://rkpxhfigmeqicnxfvbyr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcHhoZmlnbWVxaWNueGZ2YnlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNzIzMjgsImV4cCI6MjA3MDc0ODMyOH0.9oEbfWegUO63oXWnyP-Hv8bVTonNhIHsdVuZRiQT5dg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createExportDirectory() {
  const exportDir = path.join(__dirname, 'supabase-export');
  try {
    await fs.mkdir(exportDir, { recursive: true });
    console.log(`📁 Dossier d'export créé: ${exportDir}`);
    return exportDir;
  } catch (error) {
    console.error('Erreur lors de la création du dossier:', error);
    throw error;
  }
}

async function exportTable(tableName, exportDir) {
  try {
    console.log(`📊 Export de la table ${tableName}...`);
    
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    const filePath = path.join(exportDir, `${tableName}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    
    console.log(`✅ ${tableName}: ${data.length} enregistrements exportés`);
    return data;
  } catch (error) {
    console.error(`❌ Erreur lors de l'export de ${tableName}:`, error);
    throw error;
  }
}

async function exportStorageFiles(exportDir) {
  try {
    console.log('📸 Export des informations de stockage...');
    
    // Liste des buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      throw bucketsError;
    }

    const storageInfo = {
      buckets: buckets,
      files: {}
    };

    // Pour chaque bucket, lister les fichiers
    for (const bucket of buckets) {
      console.log(`📂 Listing des fichiers du bucket ${bucket.name}...`);
      
      const { data: files, error: filesError } = await supabase.storage
        .from(bucket.name)
        .list('', {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'asc' }
        });

      if (filesError) {
        console.warn(`⚠️ Erreur lors du listing du bucket ${bucket.name}:`, filesError);
        storageInfo.files[bucket.name] = [];
      } else {
        storageInfo.files[bucket.name] = files;
        console.log(`✅ ${bucket.name}: ${files.length} fichiers listés`);
      }
    }

    const filePath = path.join(exportDir, 'storage-info.json');
    await fs.writeFile(filePath, JSON.stringify(storageInfo, null, 2));
    
    console.log('✅ Informations de stockage exportées');
    return storageInfo;
  } catch (error) {
    console.error('❌ Erreur lors de l\'export du stockage:', error);
    throw error;
  }
}

async function generateMigrationReport(exportDir, albums, dayEntries, photos, storageInfo) {
  const report = {
    exportDate: new Date().toISOString(),
    summary: {
      albums: albums.length,
      dayEntries: dayEntries.length,
      photos: photos.length,
      storageBuckets: storageInfo.buckets.length,
      totalStorageFiles: Object.values(storageInfo.files).reduce((sum, files) => sum + files.length, 0)
    },
    firebaseMapping: {
      collections: {
        users: "Créé automatiquement avec Firebase Auth",
        albums: `${albums.length} documents à importer`,
        dayEntries: `${dayEntries.length} documents à importer`,
        photos: `${photos.length} documents à importer`
      },
      storage: {
        buckets: storageInfo.buckets.map(b => ({
          supabase: b.name,
          firebase: `gs://[PROJECT-ID].appspot.com/${b.name}/`,
          files: storageInfo.files[b.name]?.length || 0
        }))
      }
    },
    dataRelations: {
      albumsWithPhotos: albums.map(album => ({
        albumId: album.id,
        title: album.title,
        year: album.year,
        month: album.month,
        photoCount: photos.filter(p => p.album_id === album.id).length,
        dayEntriesCount: dayEntries.filter(d => d.album_id === album.id).length
      }))
    },
    nextSteps: [
      "1. Créer un projet Firebase",
      "2. Configurer Authentication, Firestore et Storage",
      "3. Exécuter le script d'import Firebase",
      "4. Migrer le code de l'application",
      "5. Tester et valider la migration",
      "6. Supprimer les données Supabase (après validation)"
    ]
  };

  const filePath = path.join(exportDir, 'migration-report.json');
  await fs.writeFile(filePath, JSON.stringify(report, null, 2));
  
  console.log('\n📋 RAPPORT DE MIGRATION');
  console.log('=====================');
  console.log(`Albums: ${report.summary.albums}`);
  console.log(`Journées: ${report.summary.dayEntries}`);
  console.log(`Photos: ${report.summary.photos}`);
  console.log(`Buckets de stockage: ${report.summary.storageBuckets}`);
  console.log(`Fichiers totaux: ${report.summary.totalStorageFiles}`);
  
  return report;
}

async function main() {
  try {
    console.log('🚀 Début de l\'export des données Supabase...\n');
    
    // Créer le dossier d'export
    const exportDir = await createExportDirectory();
    
    // Exporter les tables principales
    const albums = await exportTable('albums', exportDir);
    const dayEntries = await exportTable('day_entries', exportDir);
    const photos = await exportTable('photos', exportDir);
    
    // Exporter les informations de stockage
    const storageInfo = await exportStorageFiles(exportDir);
    
    // Générer le rapport de migration
    await generateMigrationReport(exportDir, albums, dayEntries, photos, storageInfo);
    
    console.log('\n🎉 Export terminé avec succès!');
    console.log(`📁 Fichiers exportés dans: ${exportDir}`);
    console.log('\nFichiers créés:');
    console.log('- albums.json');
    console.log('- day_entries.json');
    console.log('- photos.json');
    console.log('- storage-info.json');
    console.log('- migration-report.json');
    
  } catch (error) {
    console.error('\n❌ Erreur lors de l\'export:', error);
    process.exit(1);
  }
}

// Exécuter le script si appelé directement
if (require.main === module) {
  main();
}

module.exports = { main };