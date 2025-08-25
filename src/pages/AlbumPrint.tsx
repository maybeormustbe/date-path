import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PhotoMap } from '@/components/map/PhotoMap';

interface Album {
  id: string;
  title: string;
  description: string | null;
  year: number;
  month: number;
}

interface DayEntry {
  id: string;
  date: string;
  title: string | null;
  description: string | null;
  location_name: string | null;
  cover_photo?: {
    file_path: string;
    title: string;
  };
  favorite_photos: {
    id: string;
    file_path: string;
    title: string | null;
  }[];
}

export default function AlbumPrint() {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [album, setAlbum] = useState<Album | null>(null);
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([]);
  const [allFavoritePhotos, setAllFavoritePhotos] = useState<any[]>([]);
  const [mapLocations, setMapLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (albumId && user) {
      fetchPrintData();
    }
  }, [albumId, user]);

  const fetchPrintData = async () => {
    try {
      // Fetch album info
      const { data: albumData, error: albumError } = await supabase
        .from('albums')
        .select('*')
        .eq('id', albumId)
        .single();

      if (albumError) throw albumError;
      setAlbum(albumData);

      // Fetch day entries with cover photos and descriptions
      const { data: dayData, error: dayError } = await supabase.rpc('get_day_entries_with_photo_count', {
        album_id: albumId
      });

      if (dayError && dayError.code !== 'PGRST116') throw dayError;

      // Filter only days with actual content (photos > 0)
      const daysWithContent = (dayData || [])
        .filter((day: any) => day.photo_count > 0)
        .map((day: any) => ({
          id: day.id,
          date: day.date,
          title: day.title,
          description: '', // Will be fetched separately
          location_name: day.location_name,
          cover_photo: day.cover_photo_file_path ? {
            file_path: day.cover_photo_file_path,
            title: day.cover_photo_title
          } : null
        }));

      // Fetch descriptions for each day entry
      const { data: dayDescriptions, error: descError } = await supabase
        .from('day_entries')
        .select('id, description')
        .eq('album_id', albumId);

      if (descError) throw descError;

      // Fetch all favorite photos for the album
      const { data: favoritePhotos, error: favError } = await supabase
        .from('photos')
        .select('id, file_path, title, taken_at, latitude, longitude')
        .eq('album_id', albumId)
        .eq('is_favorite', true)
        .order('taken_at');

      if (favError) throw favError;
      
      // Store all favorite photos and create map locations
      setAllFavoritePhotos(favoritePhotos || []);
      
       const locations = (favoritePhotos || [])
         .filter(photo => {
           // Vérifier que les coordonnées existent et sont des nombres valides
           const lat = parseFloat(photo.latitude?.toString() || '');
           const lng = parseFloat(photo.longitude?.toString() || '');
           return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
         })
         .map(photo => ({
           id: photo.id,
           latitude: parseFloat(photo.latitude.toString()),
           longitude: parseFloat(photo.longitude.toString()),
           title: photo.title || 'Photo',
           date: photo.taken_at,
           photoCount: 1,
           selected: false
         }));
      
      setMapLocations(locations);

      // Merge descriptions and favorite photos
      const daysWithDescriptions = daysWithContent.map((day: any) => {
        const dayDesc = dayDescriptions?.find(d => d.id === day.id);
        
        // Get favorite photos for this day by filtering by date
        const dayFavorites = (favoritePhotos || []).filter(photo => {
          if (!photo.taken_at) return false;
          const photoDate = photo.taken_at.split('T')[0];
          return photoDate === day.date;
        });

        return {
          ...day,
          description: dayDesc?.description || null,
          favorite_photos: dayFavorites
        };
      });

      setDayEntries(daysWithDescriptions);

    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Function to get 9 random favorite photos for the cover mosaic
  const getRandomFavoritePhotos = (photos: any[], count: number = 9) => {
    if (photos.length <= count) return photos;
    const shuffled = [...photos].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Album non trouvé</h2>
          <Button onClick={() => navigate('/')}>Retour aux albums</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header - hidden when printing */}
      <header className="bg-card border-b border-card-border shadow-soft print:hidden">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate(`/album/${albumId}`)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour à l'album
              </Button>
              <div>
                <h1 className="text-xl font-bold">Impression - {album.title}</h1>
                <p className="text-sm text-muted-foreground">
                  {dayEntries.length} journée{dayEntries.length !== 1 ? 's' : ''} avec contenu
                </p>
              </div>
            </div>
            <Button onClick={handlePrint} className="bg-gradient-sky hover:opacity-90">
              <Printer className="h-4 w-4 mr-2" />
              Imprimer
            </Button>
          </div>
        </div>
      </header>

      {/* Print content */}
      <div className="print-container">
        {/* Album title page */}
        <div className="album-title-page">
          <div className="cover-content">
            <div className="text-center">
              <h1 className="album-main-title">{album.title}</h1>
              {album.description && (
                <p className="album-description">{album.description}</p>
              )}
              <p className="album-date">{album.month}/{album.year}</p>
            </div>
            
            {/* Photo mosaic */}
            {allFavoritePhotos.length > 0 && (
              <div className="photo-mosaic">
                <div className="mosaic-grid">
                  {getRandomFavoritePhotos(allFavoritePhotos).map((photo, index) => (
                    <div key={photo.id} className={`mosaic-item mosaic-item-${index + 1}`}>
                      <img
                        src={supabase.storage.from('photos').getPublicUrl(photo.file_path).data.publicUrl}
                        alt={photo.title || 'Photo favorite'}
                        className="mosaic-photo"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mini map */}
            {mapLocations.length > 0 && (
              <div className="mini-map-container">
                <h3 className="mini-map-title">Lieux visités</h3>
                <div className="mini-map">
                  <PhotoMap
                    locations={mapLocations}
                    selectedLocationId={null}
                    onLocationClick={() => {}}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Day entries - one per page */}
        {dayEntries.map((day, index) => (
          <div key={day.id} className="day-page">
            {/* Day title and subtitle */}
            <div className="day-header">
              <h1 className="day-main-title">
                {day.title || format(new Date(day.date), 'EEEE d MMMM yyyy', { locale: fr })}
              </h1>
              <div className="day-subtitle">
                <p className="day-date">{format(new Date(day.date), 'd MMMM yyyy', { locale: fr })}</p>
                {day.location_name && (
                  <p className="day-location">{day.location_name}</p>
                )}
              </div>
            </div>

            {/* Favorite photos mosaic */}
            {day.favorite_photos && day.favorite_photos.length > 0 && (
              <div className="day-photos-mosaic">
                <div className="photos-grid">
                  {day.favorite_photos.map((photo) => (
                    <div key={photo.id} className="photo-mosaic-item">
                      <img
                        src={supabase.storage.from('photos').getPublicUrl(photo.file_path).data.publicUrl}
                        alt={photo.title || 'Photo favorite'}
                        className="photo-mosaic-img"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Day description */}
            {day.description && (
              <div className="day-text">
                <p>{day.description}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page {
              size: A4;
              margin: 1.5cm;
            }

            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }

          .print-container {
            background: white;
            color: black;
          }

          .album-title-page {
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            page-break-after: always;
            padding: 2rem;
          }

           .cover-content {
             width: 100%;
             max-width: 800px;
             display: grid;
             grid-template-columns: 1fr 1fr;
             gap: 3rem;
             align-items: center;
           }

          .photo-mosaic {
            justify-self: end;
          }

           .mosaic-grid {
             display: grid;
             grid-template-columns: repeat(3, 1fr);
             grid-template-rows: repeat(3, 1fr);
             gap: 0.5rem;
             width: 250px;
             height: 250px;
           }

          .mosaic-item {
            overflow: hidden;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }

          .mosaic-photo {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

            .mini-map-container {
              grid-column: 1 / -1;
              text-align: center;
              margin-top: 2rem;
            }

            .mini-map-title {
              font-size: 1.2rem;
              font-weight: 600;
              margin-bottom: 1rem;
              color: #374151;
            }

            .mini-map {
              width: 100%;
              height: 313px;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }

          .print-map {
            width: 100%;
            height: 100%;
          }

           @media print {
             .mini-map {
               height: 250px;
             }
           }

           .album-main-title {
             font-size: 2.5rem;
             font-weight: bold;
             margin-bottom: 1rem;
             color: #1f2937;
           }

          .album-description {
            font-size: 1.2rem;
            margin-bottom: 2rem;
            color: #6b7280;
            max-width: 600px;
          }

          .album-date {
            font-size: 1.5rem;
            font-weight: 500;
            color: #374151;
          }

           /* Day page styles */
           .day-page {
             page-break-before: always;
             page-break-inside: avoid;
             padding: 2rem 0;
             min-height: 100vh;
           }

           .day-page:first-child {
             page-break-before: auto;
           }

           .day-header {
             text-align: center;
             margin-bottom: 2rem;
           }

           .day-main-title {
             font-size: 2rem;
             font-weight: bold;
             color: #1f2937;
             margin-bottom: 1rem;
           }

           .day-subtitle {
             display: flex;
             justify-content: center;
             gap: 2rem;
             margin-bottom: 2rem;
           }

           .day-date {
             font-size: 1.1rem;
             color: #6b7280;
             font-weight: 500;
           }

           .day-location {
             font-size: 1.1rem;
             color: #6b7280;
             font-style: italic;
           }

           .day-photos-mosaic {
             margin-bottom: 2rem;
           }

           .photos-grid {
             display: grid;
             grid-template-columns: repeat(3, 1fr);
             gap: 1rem;
             margin-bottom: 1.5rem;
           }

           .photo-mosaic-item {
             overflow: hidden;
             border-radius: 8px;
             box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
             aspect-ratio: 4/3;
           }

           .photo-mosaic-img {
             width: 100%;
             height: 100%;
             object-fit: cover;
           }

           .day-text {
             margin-top: 2rem;
           }

           .day-text p {
             font-size: 1rem;
             line-height: 1.7;
             color: #374151;
             text-align: justify;
           }

           /* Remove old day entry styles */
           .days-grid {
             display: none;
           }

           .day-entry {
             display: none;
           }

           .day-content {
             display: none;
           }

           .day-title {
             display: none;
           }

           .day-photo {
             display: none;
           }

           .photo-img {
             display: none;
           }

           .day-story {
             display: none;
           }

           .day-story p {
             display: none;
           }

           .favorite-photos {
             display: none;
           }

           .favorite-photos-title {
             display: none;
           }

          .favorite-photos-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 1rem;
            margin-bottom: 1rem;
          }

          .favorite-photo-item {
            text-align: center;
          }

          .favorite-photo-img {
            width: 100%;
            height: 80px;
            object-fit: cover;
            border-radius: 4px;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
          }

          .favorite-photo-title {
            font-size: 0.8rem;
            margin-top: 0.25rem;
            color: #6b7280;
            line-height: 1.2;
            word-break: break-word;
          }

          @media screen {
            .print-container {
              max-width: 21cm;
              margin: 0 auto;
              padding: 2rem;
              background: white;
              box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            }
          }

          @media print {
            .print\\:hidden {
              display: none !important;
            }
          }
        `
      }} />
    </>
  );
}