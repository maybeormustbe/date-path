import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Photo {
  id: string;
  album_id: string;
  taken_at: string;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
}

const DEFAULT_COORDS = { latitude: 47.218371, longitude: -1.553621 }; // Nantes, France

// Fonction de géolocalisation inverse avec cache
const locationCache = new Map<string, string>();

const reverseGeocode = async (latitude: number, longitude: number): Promise<string | undefined> => {
  const coordKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  
  if (locationCache.has(coordKey)) {
    return locationCache.get(coordKey);
  }
  
  try {
    const timeoutId = setTimeout(() => {
      throw new Error('Timeout');
    }, 5000);
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
      {
        headers: { 'User-Agent': 'PhotoApp/1.0' }
      }
    );
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const locationData = await response.json();
      if (locationData?.display_name) {
        const parts = locationData.display_name.split(',');
        const locationName = parts.slice(0, 2).join(', ').trim();
        locationCache.set(coordKey, locationName);
        return locationName;
      }
    }
  } catch (error) {
    console.warn('Erreur lors de la géolocalisation inverse:', error);
  }
  
  return undefined;
};

// Fonction pour calculer la distance Haversine
const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Rayon de la Terre en kilomètres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { albumId } = await req.json();

    if (!albumId) {
      return new Response(
        JSON.stringify({ error: 'Album ID requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Récupérer toutes les photos de l'album
    const { data: photos, error: photosError } = await supabaseClient
      .from('photos')
      .select('id, album_id, taken_at, latitude, longitude, location_name')
      .eq('album_id', albumId)
      .order('taken_at');

    if (photosError) {
      console.error('Erreur lors de la récupération des photos:', photosError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la récupération des photos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!photos || photos.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Aucune photo trouvée dans cet album' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Traitement de ${photos.length} photos pour l'album ${albumId}`);

    // Filtrer les photos avec date et les organiser par jour
    const photosWithDate = photos.filter(p => p.taken_at).sort((a, b) => 
      new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime()
    );

    if (photosWithDate.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Aucune photo avec date trouvée' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Organiser par jour
    const photosByDay = new Map<string, Photo[]>();
    photosWithDate.forEach(photo => {
      const dayKey = new Date(photo.taken_at).toISOString().split('T')[0];
      if (!photosByDay.has(dayKey)) {
        photosByDay.set(dayKey, []);
      }
      photosByDay.get(dayKey)!.push(photo);
    });

    const sortedDays = Array.from(photosByDay.keys()).sort();

    // A1 - Coordonnées de l'album : première photo avec coordonnées à partir du 2ème jour
    let albumCoords = DEFAULT_COORDS;
    if (sortedDays.length >= 2) {
      for (let dayIndex = 1; dayIndex < sortedDays.length; dayIndex++) {
        const dayPhotos = photosByDay.get(sortedDays[dayIndex])!;
        const firstPhotoWithCoords = dayPhotos.find(p => p.latitude && p.longitude);
        if (firstPhotoWithCoords) {
          albumCoords = {
            latitude: firstPhotoWithCoords.latitude!,
            longitude: firstPhotoWithCoords.longitude!
          };
          break;
        }
      }
    }

    // A2 - Coordonnées par jour : dernière photo avec coordonnées du jour
    const dayCoords = new Map<string, { latitude: number; longitude: number }>();
    sortedDays.forEach(day => {
      const dayPhotos = photosByDay.get(day)!;
      const photosWithCoords = dayPhotos.filter(p => p.latitude && p.longitude);
      
      if (photosWithCoords.length > 0) {
        const lastPhoto = photosWithCoords[photosWithCoords.length - 1];
        dayCoords.set(day, {
          latitude: lastPhoto.latitude!,
          longitude: lastPhoto.longitude!
        });
      } else {
        dayCoords.set(day, albumCoords);
      }
    });

    // A3 - Appliquer coordonnées aux photos qui n'en ont pas
    const photoUpdates: { id: string; latitude: number; longitude: number; location_name?: string }[] = [];

    for (const photo of photosWithDate) {
      let needsUpdate = false;
      let newLatitude = photo.latitude;
      let newLongitude = photo.longitude;

      if (!photo.latitude || !photo.longitude) {
        const dayKey = new Date(photo.taken_at).toISOString().split('T')[0];
        const dayPhotos = photosWithDate.filter(p => new Date(p.taken_at).toISOString().split('T')[0] === dayKey);
        const photosWithCoords = dayPhotos.filter(p => p.latitude && p.longitude);
        
        if (photosWithCoords.length > 0) {
          // Trouver la photo la plus proche en heure
          let closestPhoto = photosWithCoords[0];
          let minTimeDiff = Math.abs(new Date(photo.taken_at).getTime() - new Date(closestPhoto.taken_at).getTime());
          
          photosWithCoords.forEach(coordPhoto => {
            const timeDiff = Math.abs(new Date(photo.taken_at).getTime() - new Date(coordPhoto.taken_at).getTime());
            if (timeDiff < minTimeDiff) {
              minTimeDiff = timeDiff;
              closestPhoto = coordPhoto;
            }
          });
          
          newLatitude = closestPhoto.latitude!;
          newLongitude = closestPhoto.longitude!;
          needsUpdate = true;
        } else {
          // Aucune photo du jour n'a de coordonnées, utiliser les coordonnées du jour
          const coords = dayCoords.get(dayKey) || albumCoords;
          newLatitude = coords.latitude;
          newLongitude = coords.longitude;
          needsUpdate = true;
        }
      }

      if (needsUpdate || !photo.location_name) {
        photoUpdates.push({
          id: photo.id,
          latitude: newLatitude!,
          longitude: newLongitude!
        });
      }
    }

    // B - Lieux-dits avec cache pour éviter les doublons
    const uniqueCoords = new Set<string>();
    const coordsToResolve: { latitude: number; longitude: number }[] = [];

    // B1 - Coordonnées de l'album
    const albumCoordsKey = `${albumCoords.latitude.toFixed(4)},${albumCoords.longitude.toFixed(4)}`;
    uniqueCoords.add(albumCoordsKey);
    coordsToResolve.push(albumCoords);

    // B2 - Coordonnées de chaque jour
    dayCoords.forEach(coords => {
      const coordsKey = `${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}`;
      if (!uniqueCoords.has(coordsKey)) {
        uniqueCoords.add(coordsKey);
        coordsToResolve.push(coords);
      }
    });

    // Résoudre tous les lieux-dits uniques
    console.log(`Résolution de ${coordsToResolve.length} lieux-dits uniques`);
    const locationPromises = coordsToResolve.map(coords => reverseGeocode(coords.latitude, coords.longitude));
    await Promise.all(locationPromises);

    // B3 - Appliquer les lieux-dits aux photos
    for (const update of photoUpdates) {
      const photo = photosWithDate.find(p => p.id === update.id);
      if (photo) {
        const dayKey = new Date(photo.taken_at).toISOString().split('T')[0];
        const dayCoordinate = dayCoords.get(dayKey) || albumCoords;
        
        // Calculer la distance avec les coordonnées du jour
        const distance = calculateHaversineDistance(
          update.latitude,
          update.longitude,
          dayCoordinate.latitude,
          dayCoordinate.longitude
        );

        // B3 - Si distance < 2km, utiliser le lieu-dit du jour
        if (distance < 2) {
          const dayLocationName = locationCache.get(`${dayCoordinate.latitude.toFixed(4)},${dayCoordinate.longitude.toFixed(4)}`);
          if (dayLocationName) {
            update.location_name = dayLocationName;
          }
        }
      }
    }

    // Effectuer les mises à jour par batch
    console.log(`Mise à jour de ${photoUpdates.length} photos`);
    const batchSize = 10;
    let updatedCount = 0;

    for (let i = 0; i < photoUpdates.length; i += batchSize) {
      const batch = photoUpdates.slice(i, i + batchSize);
      
      const updatePromises = batch.map(async (update) => {
        const updateData: any = {
          latitude: update.latitude,
          longitude: update.longitude
        };
        
        if (update.location_name) {
          updateData.location_name = update.location_name;
        }

        const { error } = await supabaseClient
          .from('photos')
          .update(updateData)
          .eq('id', update.id);
        
        if (error) {
          console.error(`Erreur mise à jour photo ${update.id}:`, error);
          return false;
        }
        return true;
      });

      const results = await Promise.all(updatePromises);
      updatedCount += results.filter(r => r).length;
      
      // Petit délai entre les batches
      if (i + batchSize < photoUpdates.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Mettre à jour les day_entries avec les nouvelles coordonnées et lieux-dits
    const dayEntryUpdates: { date: string; latitude: number; longitude: number; location_name?: string }[] = [];
    
    for (const [day, coords] of dayCoords) {
      const locationName = locationCache.get(`${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}`);
      dayEntryUpdates.push({
        date: day,
        latitude: coords.latitude,
        longitude: coords.longitude,
        location_name: locationName
      });
    }

    // Mettre à jour les day_entries
    let dayEntriesUpdated = 0;
    for (const update of dayEntryUpdates) {
      const updateData: any = {
        latitude: update.latitude,
        longitude: update.longitude
      };
      
      if (update.location_name) {
        updateData.location_name = update.location_name;
      }

      const { error } = await supabaseClient
        .from('day_entries')
        .update(updateData)
        .eq('album_id', albumId)
        .eq('date', update.date);
      
      if (!error) {
        dayEntriesUpdated++;
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Métadonnées mises à jour avec succès`,
        photosUpdated: updatedCount,
        dayEntriesUpdated: dayEntriesUpdated,
        totalPhotos: photos.length,
        locationsResolved: locationCache.size
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erreur lors de la mise à jour des métadonnées:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur interne du serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});