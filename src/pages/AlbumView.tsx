import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { PhotoMap } from '@/components/map/PhotoMap';
import { PhotoUploadModal } from '@/components/photo/PhotoUploadModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus, Camera } from 'lucide-react';
import { toast } from 'sonner';

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
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  cover_photo_id: string | null;
  photo_count: number;
  cover_photo?: {
    thumbnail_path: string;
    file_path: string;
    title: string;
  };
}

export default function AlbumView() {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [album, setAlbum] = useState<Album | null>(null);
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedDayId, setSelectedDayId] = useState<string>();

  useEffect(() => {
    if (albumId && user) {
      fetchAlbumData();
    }
  }, [albumId, user]);

  const fetchAlbumData = async () => {
    try {
      // Fetch album info
      const { data: albumData, error: albumError } = await supabase
        .from('albums')
        .select('*')
        .eq('id', albumId)
        .single();

      if (albumError) throw albumError;
      setAlbum(albumData);

      // Fetch day entries with cover photo details and photo counts using RPC
      const { data: dayData, error: dayError } = await supabase.rpc('get_day_entries_with_photo_count', {
        album_id: albumId
      });

      if (dayError && dayError.code !== 'PGRST116') throw dayError;
      
      const dayEntriesWithCounts = (dayData || []).map((day: any) => ({
        id: day.id,
        date: day.date,
        title: day.title,
        location_name: day.location_name,
        latitude: day.latitude,
        longitude: day.longitude,
        cover_photo_id: day.cover_photo_id,
        photo_count: day.photo_count || 0,
        cover_photo: day.cover_photo_thumbnail_path ? {
          thumbnail_path: day.cover_photo_thumbnail_path,
          file_path: day.cover_photo_file_path,
          title: day.cover_photo_title
        } : null
      }));
      
      setDayEntries(dayEntriesWithCounts);

    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement de l\'album');
    } finally {
      setLoading(false);
    }
  };

  const mapLocations = dayEntries
    .filter(day => day.latitude && day.longitude)
    .map(day => ({
      id: day.id,
      latitude: day.latitude!,
      longitude: day.longitude!,
      title: day.cover_photo?.title || day.title || day.location_name || 'Sans titre',
      date: day.date,
      photoCount: day.photo_count,
      selected: day.id === selectedDayId
    }));

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-card-border shadow-soft">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
              <div>
                <h1 className="text-xl font-bold">{album.title}</h1>
                <p className="text-sm text-muted-foreground">
                  {album.description || `Album ${album.month}/${album.year}`}
                </p>
              </div>
            </div>
            <Button onClick={() => setUploadModalOpen(true)} className="bg-gradient-sky hover:opacity-90">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter des photos
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar with days */}
        <div className="w-80 border-r border-border bg-card/50 overflow-y-auto custom-scrollbar">
          <div className="p-6">
            <h3 className="font-semibold mb-4">Jours de l'album</h3>
            {dayEntries.length === 0 ? (
              <div className="text-center py-8">
                <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Aucune photo encore</p>
                <Button 
                  onClick={() => setUploadModalOpen(true)}
                  variant="outline"
                  size="sm"
                >
                  Ajouter des photos
                </Button>
              </div>
             ) : (
               <div className="space-y-3">
                 {dayEntries.map((day, index) => (
                   <Card 
                     key={day.id}
                     className={`cursor-pointer transition-all hover:shadow-medium ${
                       selectedDayId === day.id ? 'ring-2 ring-primary shadow-medium' : ''
                     }`}
                     onClick={() => setSelectedDayId(day.id)}
                   >
                     <CardContent className="p-3">
                       <div className="flex gap-3">
                          {/* Vignette */}
                          {day.cover_photo?.thumbnail_path && (
                            <div className="w-16 h-16 flex-shrink-0">
                              <img
                                src={supabase.storage.from('thumbnails').getPublicUrl(day.cover_photo.thumbnail_path).data.publicUrl}
                                alt="Vignette du jour"
                                className="w-full h-full object-cover rounded-md bg-muted"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                         
                         {/* Contenu texte */}
                         <div className="flex-1 min-w-0">
                           <h4 className="font-medium text-sm mb-1">
                             Jour {index + 1}
                           </h4>
                           <div className="text-xs text-muted-foreground space-y-0.5">
                             <p>{day.date}</p>
                             {day.location_name && <p>{day.location_name}</p>}
                             <p>{day.photo_count} photo{day.photo_count !== 1 ? 's' : ''}</p>
                           </div>
                         </div>
                       </div>
                     </CardContent>
                   </Card>
                 ))}
               </div>
             )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1">
          {mapLocations.length > 0 ? (
            <PhotoMap
              locations={mapLocations}
              selectedLocationId={selectedDayId}
              onLocationClick={setSelectedDayId}
              className="w-full h-full"
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-muted/20">
              <div className="text-center">
                <Camera className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucune photo géolocalisée</h3>
                <p className="text-muted-foreground mb-6">
                  Ajoutez des photos avec des données de localisation pour voir la carte
                </p>
                <Button onClick={() => setUploadModalOpen(true)} className="bg-gradient-sky hover:opacity-90">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter des photos
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <PhotoUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        albumId={albumId!}
        onUploadComplete={fetchAlbumData}
      />
    </div>
  );
}