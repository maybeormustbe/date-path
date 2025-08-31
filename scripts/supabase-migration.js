const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

// Configuration des couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, total, message) {
  log(`[${step}/${total}] ${message}`, colors.cyan);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️ ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️ ${message}`, colors.blue);
}

// Charger la configuration
async function loadConfig() {
  try {
    logInfo('Chargement de la configuration...');
    const configData = await fs.readFile('config.json', 'utf8');
    const config = JSON.parse(configData);
    logSuccess('Configuration chargée avec succès');
    return config;
  } catch (error) {
    logError('Erreur lors de la lecture du fichier config.json');
    log('📋 Suivez ces étapes:');
    log('1. Copiez config.json vers votre propre fichier de config');
    log('2. Remplissez les URLs et clés API des deux instances Supabase');
    log('3. Adaptez la liste des tables et buckets à migrer');
    throw error;
  }
}

// Créer la structure complète de la base de données
async function createStructure() {
  log('\n🏗️ CRÉATION DE LA STRUCTURE DE DONNÉES', colors.bright);
  log('==========================================', colors.bright);
  
  const config = await loadConfig();
  
  // Connexion à la destination
  logStep(1, 8, 'Connexion à la base de destination...');
  const destSupabase = createClient(
    config.destination.url,
    config.destination.service_role_key
  );
  
  try {
    // Test de connexion
    const { error: testError } = await destSupabase.from('_test').select('*').limit(1);
    if (testError && !testError.message.includes('relation "_test" does not exist')) {
      throw testError;
    }
    logSuccess('Connexion établie avec la base de destination');
  } catch (error) {
    logError('Impossible de se connecter à la base de destination');
    throw error;
  }

  // Création des tables
  logStep(2, 8, 'Création des tables...');
  await createTables(destSupabase);

  // Création des index
  logStep(3, 8, 'Création des index...');
  await createIndexes(destSupabase);

  // Activation du RLS
  logStep(4, 8, 'Activation du Row Level Security...');
  await enableRLS(destSupabase);

  // Création des politiques RLS
  logStep(5, 8, 'Création des politiques RLS...');
  await createRLSPolicies(destSupabase);

  // Création des fonctions
  logStep(6, 8, 'Création des fonctions de base de données...');
  await createFunctions(destSupabase);

  // Création des triggers
  logStep(7, 8, 'Création des triggers...');
  await createTriggers(destSupabase);

  // Création des buckets de stockage
  logStep(8, 8, 'Création des buckets de stockage...');
  await createStorageBuckets(destSupabase, config.storage_buckets || []);

  logSuccess('Structure de données créée avec succès !');
}

// Créer les tables
async function createTables(supabase) {
  const tables = [
    {
      name: 'albums',
      sql: `
        CREATE TABLE public.albums (
          id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        );
      `
    },
    {
      name: 'day_entries',
      sql: `
        CREATE TABLE public.day_entries (
          id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
          album_id UUID NOT NULL,
          user_id UUID NOT NULL,
          date DATE NOT NULL,
          title TEXT,
          description TEXT,
          location_name TEXT,
          latitude NUMERIC,
          longitude NUMERIC,
          cover_photo_id UUID,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        );
      `
    },
    {
      name: 'photos',
      sql: `
        CREATE TABLE public.photos (
          id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
          album_id UUID NOT NULL,
          user_id UUID NOT NULL,
          filename TEXT NOT NULL,
          file_path TEXT NOT NULL,
          thumbnail_path TEXT,
          title TEXT,
          location_name TEXT,
          latitude NUMERIC,
          longitude NUMERIC,
          taken_at TIMESTAMP WITH TIME ZONE,
          file_size BIGINT,
          mime_type TEXT,
          is_favorite BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        );
      `
    }
  ];

  for (const table of tables) {
    try {
      logInfo(`  Création de la table ${table.name}...`);
      const { error } = await supabase.rpc('exec_sql', { sql_query: table.sql });
      if (error && !error.message.includes('already exists')) {
        throw error;
      }
      logSuccess(`  Table ${table.name} créée`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        logWarning(`  Table ${table.name} existe déjà`);
      } else {
        logError(`  Erreur lors de la création de ${table.name}: ${error.message}`);
        throw error;
      }
    }
  }
}

// Créer les index
async function createIndexes(supabase) {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_albums_user_id ON public.albums(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_albums_year_month ON public.albums(year, month);',
    'CREATE INDEX IF NOT EXISTS idx_day_entries_album_id ON public.day_entries(album_id);',
    'CREATE INDEX IF NOT EXISTS idx_day_entries_user_id ON public.day_entries(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_day_entries_date ON public.day_entries(date);',
    'CREATE INDEX IF NOT EXISTS idx_photos_album_id ON public.photos(album_id);',
    'CREATE INDEX IF NOT EXISTS idx_photos_user_id ON public.photos(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_photos_taken_at ON public.photos(taken_at);'
  ];

  for (let i = 0; i < indexes.length; i++) {
    try {
      logInfo(`  Création de l'index ${i + 1}/${indexes.length}...`);
      const { error } = await supabase.rpc('exec_sql', { sql_query: indexes[i] });
      if (error) throw error;
      logSuccess(`  Index ${i + 1}/${indexes.length} créé`);
    } catch (error) {
      logError(`  Erreur lors de la création de l'index: ${error.message}`);
      throw error;
    }
  }
}

// Activer RLS
async function enableRLS(supabase) {
  const tables = ['albums', 'day_entries', 'photos'];
  
  for (const table of tables) {
    try {
      logInfo(`  Activation RLS pour ${table}...`);
      const { error } = await supabase.rpc('exec_sql', { 
        sql_query: `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;` 
      });
      if (error) throw error;
      logSuccess(`  RLS activé pour ${table}`);
    } catch (error) {
      logError(`  Erreur RLS pour ${table}: ${error.message}`);
      throw error;
    }
  }
}

// Créer les politiques RLS
async function createRLSPolicies(supabase) {
  const policies = [
    // Politiques pour albums
    `CREATE POLICY "Users can view their own albums" ON public.albums FOR SELECT USING (auth.uid() = user_id);`,
    `CREATE POLICY "Users can create their own albums" ON public.albums FOR INSERT WITH CHECK (auth.uid() = user_id);`,
    `CREATE POLICY "Users can update their own albums" ON public.albums FOR UPDATE USING (auth.uid() = user_id);`,
    `CREATE POLICY "Users can delete their own albums" ON public.albums FOR DELETE USING (auth.uid() = user_id);`,
    
    // Politiques pour day_entries
    `CREATE POLICY "Users can view their own day entries" ON public.day_entries FOR SELECT USING (auth.uid() = user_id);`,
    `CREATE POLICY "Users can create their own day entries" ON public.day_entries FOR INSERT WITH CHECK (auth.uid() = user_id);`,
    `CREATE POLICY "Users can update their own day entries" ON public.day_entries FOR UPDATE USING (auth.uid() = user_id);`,
    `CREATE POLICY "Users can delete their own day entries" ON public.day_entries FOR DELETE USING (auth.uid() = user_id);`,
    
    // Politiques pour photos
    `CREATE POLICY "Users can view their own photos" ON public.photos FOR SELECT USING (auth.uid() = user_id);`,
    `CREATE POLICY "Users can create their own photos" ON public.photos FOR INSERT WITH CHECK (auth.uid() = user_id);`,
    `CREATE POLICY "Users can update their own photos" ON public.photos FOR UPDATE USING (auth.uid() = user_id);`,
    `CREATE POLICY "Users can delete their own photos" ON public.photos FOR DELETE USING (auth.uid() = user_id);`
  ];

  for (let i = 0; i < policies.length; i++) {
    try {
      logInfo(`  Création politique ${i + 1}/${policies.length}...`);
      const { error } = await supabase.rpc('exec_sql', { sql_query: policies[i] });
      if (error && !error.message.includes('already exists')) {
        throw error;
      }
      logSuccess(`  Politique ${i + 1}/${policies.length} créée`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        logWarning(`  Politique ${i + 1} existe déjà`);
      } else {
        logError(`  Erreur politique ${i + 1}: ${error.message}`);
        throw error;
      }
    }
  }
}

// Créer les fonctions
async function createFunctions(supabase) {
  const functions = [
    {
      name: 'update_updated_at_column',
      sql: `
        CREATE OR REPLACE FUNCTION public.update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = now();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';
      `
    },
    {
      name: 'get_day_entries_with_photo_count',
      sql: `
        CREATE OR REPLACE FUNCTION public.get_day_entries_with_photo_count(album_id uuid)
        RETURNS TABLE(
          id uuid, 
          date date, 
          title text, 
          location_name text, 
          cover_photo_id uuid, 
          photo_count bigint, 
          cover_photo_thumbnail_path text, 
          cover_photo_file_path text, 
          cover_photo_title text, 
          cover_photo_location_name text, 
          cover_photo_latitude numeric, 
          cover_photo_longitude numeric
        )
        LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
        AS $$
        BEGIN
          RETURN QUERY
          SELECT 
            de.id,
            de.date,
            de.title,
            de.location_name,
            de.cover_photo_id,
            COALESCE(pc.photo_count, 0) as photo_count,
            cp.thumbnail_path as cover_photo_thumbnail_path,
            cp.file_path as cover_photo_file_path,
            cp.title as cover_photo_title,
            cp.location_name as cover_photo_location_name,
            cp.latitude as cover_photo_latitude,
            cp.longitude as cover_photo_longitude
          FROM day_entries de
          LEFT JOIN (
            SELECT 
              taken_at::date as photo_date,
              COUNT(*) as photo_count
            FROM photos 
            WHERE photos.album_id = get_day_entries_with_photo_count.album_id
            GROUP BY taken_at::date
          ) pc ON de.date = pc.photo_date
          LEFT JOIN photos cp ON de.cover_photo_id = cp.id
          WHERE de.album_id = get_day_entries_with_photo_count.album_id
          ORDER BY de.date;
        END;
        $$;
      `
    }
  ];

  for (const func of functions) {
    try {
      logInfo(`  Création fonction ${func.name}...`);
      const { error } = await supabase.rpc('exec_sql', { sql_query: func.sql });
      if (error) throw error;
      logSuccess(`  Fonction ${func.name} créée`);
    } catch (error) {
      logError(`  Erreur fonction ${func.name}: ${error.message}`);
      throw error;
    }
  }
}

// Créer les triggers
async function createTriggers(supabase) {
  const triggers = [
    `CREATE TRIGGER update_albums_updated_at BEFORE UPDATE ON public.albums FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();`,
    `CREATE TRIGGER update_day_entries_updated_at BEFORE UPDATE ON public.day_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();`,
    `CREATE TRIGGER update_photos_updated_at BEFORE UPDATE ON public.photos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();`
  ];

  for (let i = 0; i < triggers.length; i++) {
    try {
      logInfo(`  Création trigger ${i + 1}/${triggers.length}...`);
      const { error } = await supabase.rpc('exec_sql', { sql_query: triggers[i] });
      if (error && !error.message.includes('already exists')) {
        throw error;
      }
      logSuccess(`  Trigger ${i + 1}/${triggers.length} créé`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        logWarning(`  Trigger ${i + 1} existe déjà`);
      } else {
        logError(`  Erreur trigger ${i + 1}: ${error.message}`);
        throw error;
      }
    }
  }
}

// Créer les buckets de stockage
async function createStorageBuckets(supabase, buckets) {
  if (!buckets || buckets.length === 0) {
    logWarning('Aucun bucket de stockage configuré');
    return;
  }

  for (const bucketName of buckets) {
    try {
      logInfo(`  Création bucket ${bucketName}...`);
      
      // Créer le bucket
      const { error: bucketError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: bucketName === 'photos' ? ['image/*'] : undefined
      });
      
      if (bucketError && !bucketError.message.includes('already exists')) {
        throw bucketError;
      }

      // Créer les politiques pour le bucket
      const policies = [
        `CREATE POLICY "Users can view their own files in ${bucketName}" ON storage.objects FOR SELECT USING (bucket_id = '${bucketName}' AND auth.uid()::text = (storage.foldername(name))[1]);`,
        `CREATE POLICY "Users can upload their own files in ${bucketName}" ON storage.objects FOR INSERT WITH CHECK (bucket_id = '${bucketName}' AND auth.uid()::text = (storage.foldername(name))[1]);`,
        `CREATE POLICY "Users can update their own files in ${bucketName}" ON storage.objects FOR UPDATE USING (bucket_id = '${bucketName}' AND auth.uid()::text = (storage.foldername(name))[1]);`,
        `CREATE POLICY "Users can delete their own files in ${bucketName}" ON storage.objects FOR DELETE USING (bucket_id = '${bucketName}' AND auth.uid()::text = (storage.foldername(name))[1]);`
      ];

      for (const policy of policies) {
        const { error: policyError } = await supabase.rpc('exec_sql', { sql_query: policy });
        if (policyError && !policyError.message.includes('already exists')) {
          logWarning(`  Erreur politique storage: ${policyError.message}`);
        }
      }

      logSuccess(`  Bucket ${bucketName} créé avec ses politiques`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        logWarning(`  Bucket ${bucketName} existe déjà`);
      } else {
        logError(`  Erreur bucket ${bucketName}: ${error.message}`);
        throw error;
      }
    }
  }
}

// Export/Import des données (utilise le script existant amélioré)
async function migrateData() {
  log('\n📦 MIGRATION DES DONNÉES', colors.bright);
  log('=========================', colors.bright);
  
  const config = await loadConfig();
  
  logStep(1, 2, 'Export des données depuis la source...');
  await exportData(config);
  
  logStep(2, 2, 'Import des données vers la destination...');
  await importData(config);
  
  logSuccess('Migration des données terminée !');
}

// Export des données (version améliorée)
async function exportData(config) {
  const exportDir = 'supabase-export';
  
  // Créer le dossier d'export
  try {
    await fs.mkdir(exportDir, { recursive: true });
    logInfo(`Dossier d'export créé: ${exportDir}`);
  } catch (error) {
    logError('Erreur lors de la création du dossier d\'export');
    throw error;
  }

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

  // Export des tables
  logInfo('Export des tables...');
  for (let i = 0; i < config.tables.length; i++) {
    const tableName = config.tables[i];
    logInfo(`  [${i + 1}/${config.tables.length}] Export de ${tableName}...`);
    
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data, error } = await sourceSupabase
        .from(tableName)
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order('created_at', { ascending: true });
      
      if (error) {
        logError(`Erreur lors de l'export de ${tableName}: ${error.message}`);
        throw error;
      }
      
      if (!data || data.length === 0) break;
      
      allData = allData.concat(data);
      page++;
      
      logInfo(`    Page ${page} - ${data.length} enregistrements`);
      
      if (data.length < pageSize) break;
    }
    
    await fs.writeFile(
      path.join(exportDir, `${tableName}.json`),
      JSON.stringify(allData, null, 2)
    );
    
    exportStats.tables[tableName] = allData.length;
    logSuccess(`  ${tableName}: ${allData.length} enregistrements exportés`);
  }

  // Export des utilisateurs
  if (config.export_users && config.source.service_role_key) {
    logInfo('Export des utilisateurs...');
    try {
      const { data, error } = await sourceSupabase.auth.admin.listUsers();
      
      if (error) throw error;
      
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
      
      exportStats.users = cleanUsers.length;
      logSuccess(`Utilisateurs: ${cleanUsers.length} exportés`);
    } catch (error) {
      logError(`Erreur export utilisateurs: ${error.message}`);
    }
  }

  // Sauvegarder les statistiques
  await fs.writeFile(
    path.join(exportDir, 'export-stats.json'),
    JSON.stringify(exportStats, null, 2)
  );

  logSuccess('Export terminé !');
  log('\n📊 Statistiques d\'export:');
  Object.entries(exportStats.tables).forEach(([table, count]) => {
    log(`  - ${table}: ${count} enregistrements`);
  });
  if (exportStats.users > 0) {
    log(`  - Utilisateurs: ${exportStats.users}`);
  }
}

// Import des données (version améliorée)
async function importData(config) {
  const exportDir = 'supabase-export';
  
  // Vérifier que les données exportées existent
  try {
    await fs.access(exportDir);
  } catch (error) {
    logError('Dossier supabase-export non trouvé. Exécutez d\'abord l\'export.');
    throw error;
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

  // Import des utilisateurs en premier
  if (config.export_users && config.destination.service_role_key) {
    logInfo('Import des utilisateurs...');
    try {
      const usersData = await fs.readFile(path.join(exportDir, 'users.json'), 'utf8');
      const users = JSON.parse(usersData);
      
      let imported = 0;
      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        logInfo(`  [${i + 1}/${users.length}] Import utilisateur ${user.email}...`);
        
        try {
          const { error } = await destSupabase.auth.admin.createUser({
            email: user.email,
            password: 'temp-password-123!',
            email_confirm: true,
            user_metadata: user.user_metadata || {},
            app_metadata: user.app_metadata || {}
          });
          
          if (error && !error.message.includes('already registered')) {
            throw error;
          }
          
          imported++;
          logSuccess(`    ${user.email} importé`);
        } catch (error) {
          logWarning(`    Erreur ${user.email}: ${error.message}`);
        }
      }
      
      importStats.users = imported;
      logSuccess(`Utilisateurs: ${imported}/${users.length} importés`);
    } catch (error) {
      logWarning('Aucun fichier utilisateurs trouvé');
    }
  }

  // Import des tables
  logInfo('Import des tables...');
  for (let i = 0; i < config.tables.length; i++) {
    const tableName = config.tables[i];
    logInfo(`  [${i + 1}/${config.tables.length}] Import de ${tableName}...`);
    
    try {
      const tableData = await fs.readFile(path.join(exportDir, `${tableName}.json`), 'utf8');
      const data = JSON.parse(tableData);
      
      if (!data || data.length === 0) {
        logWarning(`    Aucune donnée pour ${tableName}`);
        continue;
      }

      // Import par lots
      const batchSize = 100;
      let imported = 0;
      
      for (let j = 0; j < data.length; j += batchSize) {
        const batch = data.slice(j, j + batchSize);
        const batchNum = Math.floor(j / batchSize) + 1;
        const totalBatches = Math.ceil(data.length / batchSize);
        
        logInfo(`    Lot ${batchNum}/${totalBatches} (${batch.length} enregistrements)...`);
        
        const { error } = await destSupabase
          .from(tableName)
          .insert(batch);
        
        if (error) {
          logError(`    Erreur lot ${batchNum}: ${error.message}`);
          throw error;
        }
        
        imported += batch.length;
        logSuccess(`    Lot ${batchNum}/${totalBatches} importé`);
      }
      
      importStats.tables[tableName] = imported;
      logSuccess(`  ${tableName}: ${imported} enregistrements importés`);
    } catch (error) {
      logError(`  Erreur ${tableName}: ${error.message}`);
    }
  }

  logSuccess('Import terminé !');
  log('\n📊 Statistiques d\'import:');
  Object.entries(importStats.tables).forEach(([table, count]) => {
    log(`  - ${table}: ${count} enregistrements`);
  });
  if (importStats.users > 0) {
    log(`  - Utilisateurs: ${importStats.users}`);
  }
}

// Point d'entrée principal
async function main() {
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'structure':
        await createStructure();
        break;
      case 'migrate':
        await migrateData();
        break;
      case 'export':
        const config = await loadConfig();
        await exportData(config);
        break;
      case 'import':
        const configImport = await loadConfig();
        await importData(configImport);
        break;
      default:
        log('\n🚀 MIGRATION SUPABASE - SCRIPT COMPLET', colors.bright);
        log('======================================', colors.bright);
        log('');
        log('Usage:');
        log('  node supabase-migration.js structure   # Créer toute la structure de données');
        log('  node supabase-migration.js migrate     # Export + Import des données');
        log('  node supabase-migration.js export      # Export uniquement');
        log('  node supabase-migration.js import      # Import uniquement');
        log('');
        log('📋 Avant de commencer:');
        log('1. Configurez votre fichier config.json');
        log('2. Assurez-vous d\'avoir les bonnes permissions');
        log('3. Testez d\'abord sur une base de test !');
        process.exit(1);
    }
  } catch (error) {
    logError(`Erreur fatale: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}