import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DayEntry {
  id: string;
  album_id: string;
  date: string;
  latitude: number;
  longitude: number;
  location_name: string;
}

interface Album {
  id: string;
  title: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Récupérer toutes les journées groupées par album
    const { data: dayEntries, error: dayEntriesError } = await supabaseClient
      .from('day_entries')
      .select('id, album_id, date, latitude, longitude, location_name')
      .order('album_id, date');

    if (dayEntriesError) {
      console.error('Erreur lors de la récupération des journées:', dayEntriesError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la récupération des journées' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!dayEntries || dayEntries.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Aucune journée trouvée' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Grouper les journées par album
    const daysByAlbum = new Map<string, DayEntry[]>();
    dayEntries.forEach(day => {
      if (!daysByAlbum.has(day.album_id)) {
        daysByAlbum.set(day.album_id, []);
      }
      daysByAlbum.get(day.album_id)!.push(day);
    });

    const frenchDays = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const frenchMonths = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                         'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

    const updates: { id: string; title: string }[] = [];

    // Traiter chaque album
    for (const [albumId, albumDays] of daysByAlbum) {
      // Trier les journées par date
      const sortedDays = albumDays.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      sortedDays.forEach((day, index) => {
        const date = new Date(day.date + 'T00:00:00');
        const dayNumber = index + 1;
        const weekDay = frenchDays[date.getDay()];
        const dayOfMonth = date.getDate();
        const month = frenchMonths[date.getMonth()];
        
        // Utiliser le lieu existant ou une valeur par défaut
        const locationName = day.location_name || '';
        
        // Format: "J1, lundi 12 juillet, La Hautière"
        const title = `J${dayNumber}, ${weekDay} ${dayOfMonth} ${month}${locationName ? `, ${locationName}` : ''}`;
        
        updates.push({
          id: day.id,
          title: title
        });
      });
    }

    console.log(`Mise à jour de ${updates.length} titres de journées`);

    // Effectuer les mises à jour par batch
    const batchSize = 10;
    let updatedCount = 0;

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      const updatePromises = batch.map(async (update) => {
        const { error } = await supabaseClient
          .from('day_entries')
          .update({ title: update.title })
          .eq('id', update.id);
        
        if (error) {
          console.error(`Erreur mise à jour journée ${update.id}:`, error);
          return false;
        }
        return true;
      });

      const results = await Promise.all(updatePromises);
      updatedCount += results.filter(r => r).length;
      
      // Petit délai entre les batches
      if (i + batchSize < updates.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `${updatedCount} titres de journées mis à jour avec succès`,
        totalProcessed: updates.length,
        updated: updatedCount
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erreur lors de la mise à jour des titres:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur interne du serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});