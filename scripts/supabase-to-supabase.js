const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

// Charger la configuration
async function loadConfig() {
  try {
    const configData = await fs.readFile('config.json', 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('❌ Erreur lors de la lecture du fichier config.json:', error.message);
    console.log('📋 Copiez config.json.example vers config.json et remplissez vos données de connexion');
    process.exit(1);
  }
}

// Créer un dossier d'export
async function createExportDirectory() {
  const exportDir = 'supabase-export';
  try {
    await fs.mkdir(exportDir, { recursive: true });
    console.log(`📁 Dossier d'export créé: ${exportDir}`);
    return exportDir;
  } catch (error) {
    console.error('❌ Erreur lors de la création du dossier d\'export:', error);
    throw error;
  }
}

// Exporter une table
async function exportTable(supabase, tableName, exportDir) {
  try {
    console.log(`📊 Export de la table: ${tableName}`);
    
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error(`❌ Erreur lors de l'export de ${tableName}:`, error);
        throw error;
      }
      
      if (!data || data.length === 0) break;
      
      allData = allData.concat(data);
      page++;
      
      if (data.length < pageSize) break;
    }
    
    await fs.writeFile(
      path.join(exportDir, `${tableName}.json`),
      JSON.stringify(allData, null, 2)
    );
    
    console.log(`✅ ${tableName}: ${allData.length} enregistrements exportés`);
    return allData.length;
  } catch (error) {
    console.error(`❌ Erreur lors de l'export de ${tableName}:`, error);
    throw error;
  }
}

// Exporter les utilisateurs
async function exportUsers(supabase, exportDir) {
  try {
    console.log('👥 Export des utilisateurs...');
    
    // Note: L'export des utilisateurs nécessite la clé service_role
    const { data, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('❌ Erreur lors de l\'export des utilisateurs:', error);
      throw error;
    }
    
    // Nettoyer les données sensibles
    const cleanUsers = data.users.map(user => ({
      id: user.id,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata
    }));
    
    await fs.writeFile(
      path.join(exportDir, 'users.json'),
      JSON.stringify(cleanUsers, null, 2)
    );
    
    console.log(`✅ Utilisateurs: ${cleanUsers.length} utilisateurs exportés`);
    return cleanUsers.length;
  } catch (error) {
    console.error('❌ Erreur lors de l\'export des utilisateurs:', error);
    throw error;
  }
}

// Exporter les fichiers de storage
async function exportStorageInfo(supabase, buckets, exportDir) {
  try {
    console.log('📁 Export des informations de storage...');
    
    const storageInfo = {
      buckets: [],
      files: {}
    };
    
    for (const bucketName of buckets) {
      console.log(`📦 Analyse du bucket: ${bucketName}`);
      
      // Lister les fichiers du bucket
      const { data: files, error } = await supabase.storage
        .from(bucketName)
        .list('', { limit: 1000, sortBy: { column: 'created_at', order: 'asc' } });
      
      if (error) {
        console.warn(`⚠️ Impossible d'accéder au bucket ${bucketName}:`, error.message);
        continue;
      }
      
      // Informations du bucket
      storageInfo.buckets.push({
        name: bucketName,
        fileCount: files?.length || 0
      });
      
      // Informations des fichiers
      storageInfo.files[bucketName] = files?.map(file => ({
        name: file.name,
        size: file.metadata?.size,
        mimetype: file.metadata?.mimetype,
        created_at: file.created_at,
        updated_at: file.updated_at
      })) || [];
    }
    
    await fs.writeFile(
      path.join(exportDir, 'storage-info.json'),
      JSON.stringify(storageInfo, null, 2)
    );
    
    console.log('✅ Informations de storage exportées');
    return storageInfo;
  } catch (error) {
    console.error('❌ Erreur lors de l\'export du storage:', error);
    throw error;
  }
}

// Importer une table
async function importTable(supabase, tableName, data) {
  try {
    console.log(`📥 Import de la table: ${tableName}`);
    
    if (!data || data.length === 0) {
      console.log(`⚠️ Aucune donnée à importer pour ${tableName}`);
      return 0;
    }
    
    // Importer par lots pour éviter les timeouts
    const batchSize = 100;
    let imported = 0;
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from(tableName)
        .insert(batch);
      
      if (error) {
        console.error(`❌ Erreur lors de l'import du lot ${Math.floor(i / batchSize) + 1} de ${tableName}:`, error);
        throw error;
      }
      
      imported += batch.length;
      console.log(`📊 ${tableName}: ${imported}/${data.length} enregistrements importés`);
    }
    
    console.log(`✅ ${tableName}: ${imported} enregistrements importés avec succès`);
    return imported;
  } catch (error) {
    console.error(`❌ Erreur lors de l'import de ${tableName}:`, error);
    throw error;
  }
}

// Importer les utilisateurs
async function importUsers(supabase, users) {
  try {
    console.log('👥 Import des utilisateurs...');
    
    if (!users || users.length === 0) {
      console.log('⚠️ Aucun utilisateur à importer');
      return 0;
    }
    
    let imported = 0;
    
    for (const user of users) {
      try {
        // Créer l'utilisateur avec un mot de passe temporaire
        const { data, error } = await supabase.auth.admin.createUser({
          email: user.email,
          password: 'temp-password-123!', // L'utilisateur devra réinitialiser
          email_confirm: true,
          user_metadata: user.user_metadata || {},
          app_metadata: user.app_metadata || {}
        });
        
        if (error) {
          console.warn(`⚠️ Impossible d'importer l'utilisateur ${user.email}:`, error.message);
          continue;
        }
        
        imported++;
        
      } catch (error) {
        console.warn(`⚠️ Erreur lors de l'import de l'utilisateur ${user.email}:`, error.message);
      }
    }
    
    console.log(`✅ Utilisateurs: ${imported}/${users.length} utilisateurs importés`);
    console.log('⚠️ IMPORTANT: Tous les utilisateurs ont un mot de passe temporaire et doivent le réinitialiser');
    
    return imported;
  } catch (error) {
    console.error('❌ Erreur lors de l\'import des utilisateurs:', error);
    throw error;
  }
}

// Export des données
async function exportData() {
  console.log('🚀 Début de l\'export Supabase');
  console.log('============================');
  
  const config = await loadConfig();
  const exportDir = await createExportDirectory();
  
  // Connexion à la source
  const sourceSupabase = createClient(
    config.source.url,
    config.source.service_role_key || config.source.anon_key
  );
  
  const exportStats = {
    tables: {},
    users: 0,
    storage: null
  };
  
  try {
    // Export des tables
    for (const tableName of config.tables) {
      const count = await exportTable(sourceSupabase, tableName, exportDir);
      exportStats.tables[tableName] = count;
    }
    
    // Export des utilisateurs
    if (config.export_users && config.source.service_role_key) {
      exportStats.users = await exportUsers(sourceSupabase, exportDir);
    } else if (config.export_users) {
      console.warn('⚠️ Export des utilisateurs ignoré: service_role_key requis');
    }
    
    // Export du storage
    if (config.storage_buckets && config.storage_buckets.length > 0) {
      exportStats.storage = await exportStorageInfo(sourceSupabase, config.storage_buckets, exportDir);
    }
    
    // Sauvegarde des statistiques
    await fs.writeFile(
      path.join(exportDir, 'export-stats.json'),
      JSON.stringify(exportStats, null, 2)
    );
    
    console.log('\n✅ Export terminé avec succès !');
    console.log('📊 Statistiques:');
    Object.entries(exportStats.tables).forEach(([table, count]) => {
      console.log(`  - ${table}: ${count} enregistrements`);
    });
    if (exportStats.users > 0) {
      console.log(`  - Utilisateurs: ${exportStats.users}`);
    }
    
  } catch (error) {
    console.error('❌ Erreur durant l\'export:', error);
    process.exit(1);
  }
}

// Import des données
async function importData() {
  console.log('🚀 Début de l\'import Supabase');
  console.log('============================');
  
  const config = await loadConfig();
  const exportDir = 'supabase-export';
  
  // Vérifier que les données exportées existent
  try {
    await fs.access(exportDir);
  } catch (error) {
    console.error('❌ Dossier supabase-export non trouvé. Exécutez d\'abord l\'export.');
    process.exit(1);
  }
  
  // Connexion à la destination
  const destSupabase = createClient(
    config.destination.url,
    config.destination.service_role_key || config.destination.anon_key
  );
  
  const importStats = {
    tables: {},
    users: 0
  };
  
  try {
    // Import des utilisateurs en premier (si nécessaire)
    if (config.export_users && config.destination.service_role_key) {
      try {
        const usersData = await fs.readFile(path.join(exportDir, 'users.json'), 'utf8');
        const users = JSON.parse(usersData);
        importStats.users = await importUsers(destSupabase, users);
      } catch (error) {
        console.warn('⚠️ Aucun fichier utilisateurs trouvé ou erreur lors de l\'import');
      }
    }
    
    // Import des tables
    for (const tableName of config.tables) {
      try {
        const tableData = await fs.readFile(path.join(exportDir, `${tableName}.json`), 'utf8');
        const data = JSON.parse(tableData);
        const count = await importTable(destSupabase, tableName, data);
        importStats.tables[tableName] = count;
      } catch (error) {
        console.warn(`⚠️ Impossible d'importer ${tableName}:`, error.message);
      }
    }
    
    console.log('\n✅ Import terminé avec succès !');
    console.log('📊 Statistiques:');
    Object.entries(importStats.tables).forEach(([table, count]) => {
      console.log(`  - ${table}: ${count} enregistrements`);
    });
    if (importStats.users > 0) {
      console.log(`  - Utilisateurs: ${importStats.users}`);
    }
    
    console.log('\n📋 Étapes suivantes:');
    console.log('1. Vérifiez que toutes les données ont été importées correctement');
    console.log('2. Si vous avez importé des utilisateurs, ils doivent réinitialiser leur mot de passe');
    console.log('3. Les fichiers de storage doivent être migrés manuellement');
    
  } catch (error) {
    console.error('❌ Erreur durant l\'import:', error);
    process.exit(1);
  }
}

// Point d'entrée principal
async function main() {
  const command = process.argv[2];
  
  if (command === 'export') {
    await exportData();
  } else if (command === 'import') {
    await importData();
  } else {
    console.log('Usage:');
    console.log('  node supabase-to-supabase.js export   # Exporter les données');
    console.log('  node supabase-to-supabase.js import   # Importer les données');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}