import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PhotoMetadata {
  id: string;
  date?: Date;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  dayTitle?: string;
}

interface ProcessedPhoto {
  id: string;
  albumId: string;
  filename: string;
  filePath: string;
  thumbnailPath?: string;
  takenAt?: string;
  latitude?: number;
  longitude: number;
  locationName?: string;
  title?: string;
  userId: string;
  fileSize?: number;
  mimeType?: string;
}

interface DayEntry {
  date: string;
  coverPhotoId?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  title: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { photos, albumId, userId } = await req.json();
    console.log(`Processing ${photos.length} photos for album ${albumId}`);

    // Coordonnées par défaut (Nantes, France)
    const DEFAULT_COORDS = { latitude: 47.2184, longitude: -1.5536 };
    
    // Cache pour les requêtes de géolocalisation
    const locationCache = new Map<string, string>();

    // Fonction pour calculer la distance Haversine
    const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371; // Rayon de la Terre en km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    // Fonction pour le reverse geocoding avec cache
    const reverseGeocode = async (latitude: number, longitude: number): Promise<string | undefined> => {
      const coordKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
      
      if (locationCache.has(coordKey)) {
        return locationCache.get(coordKey);
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
          { 
            signal: controller.signal,
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

    // Trier les photos par date
    const photosWithDate = photos.filter((p: PhotoMetadata) => p.date).sort((a: PhotoMetadata, b: PhotoMetadata) => 
      new Date(a.date!).getTime() - new Date(b.date!).getTime()
    );

    console.log(`${photosWithDate.length} photos with dates found`);

    if (photosWithDate.length === 0) {
      return new Response(
        JSON.stringify({ photos: photos, dayEntries: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Organiser par jour
    const photosByDay = new Map<string, PhotoMetadata[]>();
    photosWithDate.forEach((photo: PhotoMetadata) => {
      const dayKey = new Date(photo.date!).toISOString().split('T')[0];
      if (!photosByDay.has(dayKey)) {
        photosByDay.set(dayKey, []);
      }
      photosByDay.get(dayKey)!.push(photo);
    });

    const sortedDays = Array.from(photosByDay.keys()).sort();
    console.log(`Photos organized into ${sortedDays.length} days`);

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
          console.log(`Album coordinates found: ${albumCoords.latitude}, ${albumCoords.longitude}`);
          break;
        }
      }
    }
    if (albumCoords === DEFAULT_COORDS) {
      console.log('Using default coordinates (Nantes, France)');
    }

    // A2 - Coordonnées et vignettes par jour
    const dayCoords = new Map<string, { latitude: number; longitude: number; coverPhotoId?: string }>();
    sortedDays.forEach(day => {
      const dayPhotos = photosByDay.get(day)!;
      const photosWithCoords = dayPhotos.filter(p => p.latitude && p.longitude);
      
      if (photosWithCoords.length > 0) {
        // Dernière photo avec coordonnées = vignette du jour
        const lastPhoto = photosWithCoords[photosWithCoords.length - 1];
        dayCoords.set(day, {
          latitude: lastPhoto.latitude!,
          longitude: lastPhoto.longitude!,
          coverPhotoId: lastPhoto.id
        });
      } else {
        // Dernière photo du jour = vignette
        const lastPhoto = dayPhotos[dayPhotos.length - 1];
        dayCoords.set(day, {
          latitude: albumCoords.latitude,
          longitude: albumCoords.longitude,
          coverPhotoId: lastPhoto.id
        });
      }
    });

    // A3 - Appliquer coordonnées aux photos qui n'en ont pas
    photos.forEach((photo: PhotoMetadata) => {
      if (photo.date && (!photo.latitude || !photo.longitude)) {
        const dayKey = new Date(photo.date).toISOString().split('T')[0];
        const dayPhotos = photos.filter((p: PhotoMetadata) => 
          p.date && new Date(p.date).toISOString().split('T')[0] === dayKey
        );
        const photosWithCoords = dayPhotos.filter(p => p.latitude && p.longitude);
        
        if (photosWithCoords.length > 0) {
          // Trouver la photo la plus proche en heure
          let closestPhoto = photosWithCoords[0];
          let minTimeDiff = Math.abs(new Date(photo.date).getTime() - new Date(closestPhoto.date!).getTime());
          
          photosWithCoords.forEach((coordPhoto: PhotoMetadata) => {
            const timeDiff = Math.abs(new Date(photo.date!).getTime() - new Date(coordPhoto.date!).getTime());
            if (timeDiff < minTimeDiff) {
              minTimeDiff = timeDiff;
              closestPhoto = coordPhoto;
            }
          });
          
          photo.latitude = closestPhoto.latitude!;
          photo.longitude = closestPhoto.longitude!;
        } else {
          // Utiliser les coordonnées du jour
          const coords = dayCoords.get(dayKey) || albumCoords;
          photo.latitude = coords.latitude;
          photo.longitude = coords.longitude;
        }
      }
    });

    console.log('Coordinates assignment completed');

    // B - Lieux-dits avec cache
    console.log('Starting location processing...');

    // B1 - Pour chaque vignette de journée, chercher le lieu dit
    const dayLocations = new Map<string, string>();
    const coordsToResolve = new Set<string>();
    
    for (const [day, coords] of dayCoords.entries()) {
      const coordKey = `${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}`;
      coordsToResolve.add(coordKey);
    }

    // Résoudre les lieux-dits des vignettes
    console.log(`Resolving locations for ${coordsToResolve.size} unique coordinates`);
    for (const coordKey of coordsToResolve) {
      const [lat, lng] = coordKey.split(',').map(Number);
      await reverseGeocode(lat, lng);
    }

    // B2 & B3 - Appliquer les lieux-dits avec logique itérative (max 5 fois)
    for (const day of sortedDays) {
      const dayPhotos = photosByDay.get(day)!;
      const dayCoordinate = dayCoords.get(day)!;
      
      // B2 - Lieu-dit de la vignette du jour
      const dayLocationKey = `${dayCoordinate.latitude.toFixed(4)},${dayCoordinate.longitude.toFixed(4)}`;
      const dayLocationName = locationCache.get(dayLocationKey);
      if (dayLocationName) {
        dayLocations.set(day, dayLocationName);
      }

      // B2 - Photos à moins de 5km utilisent le lieu dit du jour
      dayPhotos.forEach((photo: PhotoMetadata) => {
        if (photo.latitude && photo.longitude) {
          const distance = calculateHaversineDistance(
            photo.latitude,
            photo.longitude,
            dayCoordinate.latitude,
            dayCoordinate.longitude
          );
          
          if (distance < 5 && dayLocationName) {
            photo.locationName = dayLocationName;
          }
        }
      });

      // B3 - Logique itérative pour les photos sans lieu dit
      let iterations = 0;
      let hasPhotosWithoutLocation = true;

      while (iterations < 5 && hasPhotosWithoutLocation) {
        // Trouver la première photo avec coordonnées mais sans lieu dit
        const photoWithoutLocation = dayPhotos.find((photo: PhotoMetadata) => 
          photo.latitude && photo.longitude && !photo.locationName
        );

        if (!photoWithoutLocation) {
          hasPhotosWithoutLocation = false;
          break;
        }

        // Chercher le lieu dit pour cette photo
        const photoLocationName = await reverseGeocode(
          photoWithoutLocation.latitude!, 
          photoWithoutLocation.longitude!
        );

        if (photoLocationName) {
          photoWithoutLocation.locationName = photoLocationName;

          // B2 - Appliquer ce lieu dit aux autres photos à moins de 5km
          dayPhotos.forEach((otherPhoto: PhotoMetadata) => {
            if (otherPhoto.latitude && otherPhoto.longitude && !otherPhoto.locationName) {
              const distance = calculateHaversineDistance(
                otherPhoto.latitude,
                otherPhoto.longitude,
                photoWithoutLocation.latitude!,
                photoWithoutLocation.longitude!
              );
              
              if (distance < 5) {
                otherPhoto.locationName = photoLocationName;
              }
            }
          });
        }

        iterations++;
      }
    }

    console.log('Location processing completed');

    // Génération des titres de journée
    const dayEntries: DayEntry[] = [];
    const frenchDays = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const frenchMonths = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                         'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    
    sortedDays.forEach((day, index) => {
      const date = new Date(day + 'T00:00:00');
      const dayNumber = index + 1;
      const weekDay = frenchDays[date.getDay()];
      const dayOfMonth = date.getDate();
      const month = frenchMonths[date.getMonth()];
      
      const dayCoordinate = dayCoords.get(day)!;
      const locationName = dayLocations.get(day) || '';
      
      const title = locationName 
        ? `J${dayNumber}, ${weekDay} ${dayOfMonth} ${month}, ${locationName}`
        : `J${dayNumber}, ${weekDay} ${dayOfMonth} ${month}`;

      dayEntries.push({
        date: day,
        coverPhotoId: dayCoordinate.coverPhotoId,
        latitude: dayCoordinate.latitude,
        longitude: dayCoordinate.longitude,
        locationName,
        title
      });

      // Mettre le titre dans les métadonnées des photos du jour
      photosByDay.get(day)!.forEach((photo: PhotoMetadata) => {
        photo.dayTitle = title;
      });
    });

    console.log(`Generated ${dayEntries.length} day entries`);

    return new Response(
      JSON.stringify({ 
        photos: photos,
        dayEntries: dayEntries,
        albumCoords: albumCoords 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error processing photo metadata:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});