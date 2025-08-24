import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { PhotoMap } from '@/components/map/PhotoMap';
import { PhotoUploadModal } from '@/components/photo/PhotoUploadModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowLeft, Plus, Camera, Edit2, Check, X, Play, Printer, Binoculars, Settings, MapPin, Type } from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';
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
  const [editingDayId, setEditingDayId] = useState<string>();
  const [editingTitle, setEditingTitle] = useState('');
  const [isUpdatingMetadata, setIsUpdatingMetadata] = useState(false);
  const [isUpdatingTitles, setIsUpdatingTitles] = useState(false);

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
      
      // Get all photos to determine date range
      const { data: photosData, error: photosError } = await supabase
        .from('photos')
        .select('taken_at')
        .eq('album_id', albumId)
        .not('taken_at', 'is', null)
        .order('taken_at');

      if (photosError) throw photosError;

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

      // Create complete day list including missing days
      let completeDayEntries = [...dayEntriesWithCounts];

      if (photosData && photosData.length > 0) {
        const firstDate = parseISO(photosData[0].taken_at.split('T')[0]);
        const lastDate = parseISO(photosData[photosData.length - 1].taken_at.split('T')[0]);
        
        const allDates = [];
        let currentDate = firstDate;
        
        while (currentDate <= lastDate) {
          allDates.push(format(currentDate, 'yyyy-MM-dd'));
          currentDate = addDays(currentDate, 1);
        }

        // Add missing days
        allDates.forEach(dateStr => {
          const existingDay = dayEntriesWithCounts.find(day => day.date === dateStr);
          if (!existingDay) {
            completeDayEntries.push({
              id: `placeholder-${dateStr}`,
              date: dateStr,
              title: null,
              location_name: null,
              latitude: null,
              longitude: null,
              cover_photo_id: null,
              photo_count: 0,
              cover_photo: null
            });
          }
        });

        // Sort by date
        completeDayEntries.sort((a, b) => a.date.localeCompare(b.date));
      }
      
      setDayEntries(completeDayEntries);

    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement de l\'album');
    } finally {
      setLoading(false);
    }
  };

  const startEditingTitle = (day: DayEntry, index: number) => {
    setEditingDayId(day.id);
    setEditingTitle(day.title || `Jour ${index + 1}`);
  };

  const saveTitle = async (dayId: string) => {
    try {
      const { error } = await supabase
        .from('day_entries')
        .update({ title: editingTitle })
        .eq('id', dayId);

      if (error) throw error;

      // Update local state
      setDayEntries(prev => prev.map(day => 
        day.id === dayId ? { ...day, title: editingTitle } : day
      ));
      
      setEditingDayId(undefined);
      setEditingTitle('');
      toast.success('Titre mis à jour');
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la mise à jour du titre');
    }
  };

  const cancelEditing = () => {
    setEditingDayId(undefined);
    setEditingTitle('');
  };

  const handleUpdateMetadata = async () => {
    setIsUpdatingMetadata(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('update-album-metadata', {
        body: { albumId }
      });

      if (error) {
        console.error('Erreur lors de la mise à jour des métadonnées:', error);
        toast.error('Impossible de mettre à jour les métadonnées de l\'album');
        return;
      }

      toast.success(`${data.photosUpdated} photos et ${data.dayEntriesUpdated} journées mises à jour`);

      // Recharger la page pour voir les changements
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Une erreur inattendue s\'est produite');
    } finally {
      setIsUpdatingMetadata(false);
    }
  };

  const handleUpdateTitles = async () => {
    setIsUpdatingTitles(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('update-day-titles', {
        body: {}
      });

      if (error) {
        console.error('Erreur lors de la mise à jour des titres:', error);
        toast.error('Impossible de mettre à jour les titres des journées');
        return;
      }

      toast.success(data.message || 'Titres des journées mis à jour avec succès');

      // Recharger la page pour voir les changements
      window.location.reload();

    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Une erreur inattendue s\'est produite');
    } finally {
      setIsUpdatingTitles(false);
    }
  };

  const mapLocations = dayEntries
    .filter(day => day.latitude && day.longitude && !day.id.startsWith('placeholder-'))
    .map((day, index) => {
      const dayIndex = dayEntries.findIndex(d => d.id === day.id) + 1;
      return {
        id: day.id,
        latitude: day.latitude!,
        longitude: day.longitude!,
        title: day.title || `Jour ${dayIndex}`,
        date: day.date,
        photoCount: day.photo_count,
        selected: day.id === selectedDayId
      };
    });

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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 z-[9999] bg-background">
                <DropdownMenuItem onClick={handleUpdateMetadata} disabled={isUpdatingMetadata}>
                  <MapPin className="h-4 w-4 mr-2" />
                  Mettre à jour les lieux
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleUpdateTitles} disabled={isUpdatingTitles}>
                  <Type className="h-4 w-4 mr-2" />
                  Mettre à jour les titres
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/album/${albumId}/print`)}>
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/album/${albumId}/slideshow`)}>
                  <Play className="h-4 w-4 mr-2" />
                  Diaporama
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setUploadModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter des photos
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)]">
        {/* Sidebar with days */}
        <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-border bg-card/50 overflow-y-auto custom-scrollbar max-h-[60vh] lg:max-h-none">
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
                      className={`group cursor-pointer transition-all hover:shadow-medium ${
                        selectedDayId === day.id ? 'ring-2 ring-primary shadow-medium' : ''
                      } ${day.id.startsWith('placeholder-') ? 'opacity-60' : ''}`}
                      onClick={() => !day.id.startsWith('placeholder-') && editingDayId !== day.id && setSelectedDayId(day.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex gap-3">
                           {/* Vignette ou placeholder */}
                           <div className="w-16 h-16 flex-shrink-0">
                             {day.cover_photo?.thumbnail_path ? (
                               <img
                                 src={supabase.storage.from('thumbnails').getPublicUrl(day.cover_photo.thumbnail_path).data.publicUrl}
                                 alt="Vignette du jour"
                                 className="w-full h-full object-cover rounded-md bg-muted"
                                 onError={(e) => {
                                   e.currentTarget.style.display = 'none';
                                 }}
                               />
                             ) : (
                               <div className="w-full h-full bg-muted rounded-md" />
                             )}
                           </div>
                          
                          {/* Contenu texte */}
                          <div className="flex-1 min-w-0">
                             <div className="flex items-center justify-between mb-1">
                               <h4 className="font-medium text-sm">
                                 {day.title || `Jour ${index + 1}`}
                               </h4>
                                {!day.id.startsWith('placeholder-') && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/album/${albumId}/day/${day.id}`);
                                    }}
                                  >
                                    <Binoculars className="h-4 w-4" />
                                  </Button>
                                )}
                            </div>
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