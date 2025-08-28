import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { PhotoMap } from '@/components/map/PhotoMap';
import { PhotoModal } from '@/components/photo/PhotoModal';
import { PhotoActions } from '@/components/photo/PhotoActions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, MapPin, Save, Star, Binoculars } from 'lucide-react';
import { toast } from 'sonner';
import { calculateDayTitle } from '@/utils/dayTitleFormatter';

interface Album {
  id: string;
  title: string;
}

interface DayEntry {
  id: string;
  date: string;
  title: string | null;
  description: string | null;
  cover_photo_id: string | null;
}

interface Photo {
  id: string;
  title: string | null;
  thumbnail_path: string | null;
  file_path: string;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  taken_at: string | null;
  is_favorite: boolean;
}

export default function DayView() {
  const { albumId, dayId } = useParams<{ albumId: string; dayId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [album, setAlbum] = useState<Album | null>(null);
  const [dayEntry, setDayEntry] = useState<DayEntry | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string>();
  const [dayDescription, setDayDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalPhoto, setModalPhoto] = useState<Photo | null>(null);
  const [editingPhotoId, setEditingPhotoId] = useState<string>();
  const [editingPhotoTitle, setEditingPhotoTitle] = useState('');
  const [dayNumber, setDayNumber] = useState<number>(1);
  const [coverPhoto, setCoverPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    if (albumId && dayId && user) {
      fetchData();
    }
  }, [albumId, dayId, user]);

  const fetchData = async () => {
    try {
      // Fetch album info
      const { data: albumData, error: albumError } = await supabase
        .from('albums')
        .select('id, title')
        .eq('id', albumId)
        .single();

      if (albumError) throw albumError;
      setAlbum(albumData);

      // Fetch day entry
      const { data: dayData, error: dayError } = await supabase
        .from('day_entries')
        .select('*')
        .eq('id', dayId)
        .single();

      if (dayError) throw dayError;
      setDayEntry(dayData);
      setDayDescription(dayData.description || '');

      // Calculer le numéro de jour dans l'album
      const { data: allDaysData, error: allDaysError } = await supabase
        .from('day_entries')
        .select('date')
        .eq('album_id', albumId)
        .order('date');

      if (!allDaysError && allDaysData) {
        const dayIndex = allDaysData.findIndex(d => d.date === dayData.date);
        setDayNumber(dayIndex + 1);
      }

      // Fetch photos for this day
      const { data: photosData, error: photosError } = await supabase
        .from('photos')
        .select('*')
        .eq('album_id', albumId)
        .gte('taken_at', `${dayData.date}T00:00:00`)
        .lt('taken_at', `${dayData.date}T23:59:59`)
        .order('taken_at');

      if (photosError) throw photosError;
      setPhotos(photosData || []);

      // Find cover photo if exists
      if (dayData.cover_photo_id && photosData) {
        const foundCoverPhoto = photosData.find(p => p.id === dayData.cover_photo_id);
        setCoverPhoto(foundCoverPhoto || null);
      }

    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const saveDescription = async () => {
    if (!dayId) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('day_entries')
        .update({ description: dayDescription })
        .eq('id', dayId);

      if (error) throw error;
      toast.success('Description sauvegardée');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleSetAsCover = async (photoId: string) => {
    try {
      const { error } = await supabase
        .from('day_entries')
        .update({ cover_photo_id: photoId })
        .eq('id', dayId);

      if (error) throw error;
      
      toast.success('Photo définie comme miniature du jour');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Erreur lors de la définition de la miniature:', error);
      toast.error('Erreur lors de la définition de la miniature');
    }
  };

  const startEditingPhotoTitle = (photo: Photo) => {
    setEditingPhotoId(photo.id);
    setEditingPhotoTitle(photo.title || '');
  };

  const savePhotoTitle = async () => {
    if (!editingPhotoId) return;
    
    try {
      const { error } = await supabase
        .from('photos')
        .update({ title: editingPhotoTitle || null })
        .eq('id', editingPhotoId);

      if (error) throw error;
      
      toast.success('Titre modifié');
      setEditingPhotoId(undefined);
      setEditingPhotoTitle('');
      fetchData();
    } catch (error) {
      console.error('Erreur lors de la modification du titre:', error);
      toast.error('Erreur lors de la modification');
    }
  };

  const cancelEditingPhotoTitle = () => {
    setEditingPhotoId(undefined);
    setEditingPhotoTitle('');
  };

  const toggleFavorite = async (photoId: string, currentFavoriteStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('photos')
        .update({ is_favorite: !currentFavoriteStatus })
        .eq('id', photoId);

      if (error) throw error;
      
      toast.success(!currentFavoriteStatus ? 'Photo ajoutée aux favoris' : 'Photo retirée des favoris');
      fetchData();
    } catch (error) {
      console.error('Erreur lors de la modification des favoris:', error);
      toast.error('Erreur lors de la modification');
    }
  };

  const mapLocations = useMemo(() => 
    photos
      .filter(photo => photo.latitude && photo.longitude)
      .map(photo => ({
        id: photo.id,
        latitude: photo.latitude!,
        longitude: photo.longitude!,
        title: photo.title || `Photo ${photo.id.slice(0, 8)}`,
        date: photo.taken_at || '',
        photoCount: 1,
        selected: photo.id === selectedPhotoId
      })), [photos, selectedPhotoId, dayEntry]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!album || !dayEntry) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Journée non trouvée</h2>
          <Button onClick={() => navigate(`/album/${albumId}`)}>Retour à l'album</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className={`bg-card border-b border-card-border shadow-soft ${isMobile ? 'h-[25vh]' : ''}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 h-full">
          <div className="flex items-center justify-between h-full">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate(`/album/${albumId}`)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour à l'album
              </Button>
              <div>
                <h1 className="text-xl font-bold">
                  {album.title} - {dayEntry && calculateDayTitle({ ...dayEntry, cover_photo: coverPhoto }, dayNumber)}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {coverPhoto?.location_name ? `${coverPhoto.location_name} - ` : ''}{new Date(dayEntry.date).toLocaleDateString('fr-FR')} - {photos.length} photo{photos.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-col lg:flex-row h-[75vh] lg:h-[calc(100vh-200px)]">
        {/* Photos list */}
        <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-border bg-card/50 overflow-y-auto custom-scrollbar h-full lg:max-h-none">
          <div className="p-6">
            <h3 className="font-semibold mb-4">Photos de la journée</h3>
            {photos.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune photo pour cette journée</p>
              </div>
            ) : (
              <div className="space-y-3">
                 {photos.map(photo => {
                  const isCoverPhoto = dayEntry?.cover_photo_id === photo.id;
                  return (
                  <Card 
                    key={photo.id} 
                    className={`group cursor-pointer transition-all hover:shadow-medium ${
                      selectedPhotoId === photo.id ? 'ring-2 ring-primary shadow-medium' : ''
                    } ${isCoverPhoto ? 'ring-2 ring-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' : ''}`}
                    onClick={() => setSelectedPhotoId(photo.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex gap-3">
                        {/* Thumbnail */}
                        <div className="w-16 h-16 flex-shrink-0 relative">
                          {photo.thumbnail_path && (
                            <img
                              src={supabase.storage.from('thumbnails').getPublicUrl(photo.thumbnail_path).data.publicUrl}
                              alt="Vignette"
                              className="w-full h-full object-cover rounded-md bg-muted"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                          {/* Icône étoile pour la photo de couverture */}
                          {isCoverPhoto && (
                            <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-1">
                              <Star className="h-3 w-3 text-white fill-white" />
                            </div>
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {editingPhotoId === photo.id ? (
                            <Input
                              value={editingPhotoTitle}
                              onChange={(e) => setEditingPhotoTitle(e.target.value)}
                              className="h-6 text-sm font-medium mb-1 p-1"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') savePhotoTitle();
                                if (e.key === 'Escape') cancelEditingPhotoTitle();
                              }}
                              onBlur={savePhotoTitle}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-sm mb-1">
                                {photo.title || 'Photo sans titre'}
                              </h4>
                              {isCoverPhoto && (
                                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                              )}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {photo.location_name && <p>{photo.location_name}</p>}
                            {photo.taken_at && (
                              <p>{new Date(photo.taken_at).toLocaleTimeString('fr-FR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}</p>
                            )}
                          </div>
                        </div>
                        
                        {/* Favorite Star */}
                        <div className="flex-shrink-0 mr-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleFavorite(photo.id, photo.is_favorite)}
                          >
                            <Star 
                              className={`h-4 w-4 ${photo.is_favorite ? 'text-blue-500 fill-blue-500' : 'text-muted-foreground'}`}
                            />
                          </Button>
                        </div>
                        
                        {/* View Photo Button */}
                        <div className="flex-shrink-0 mr-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setModalPhoto(photo)}
                          >
                            <Binoculars className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <PhotoActions
                            photo={photo}
                            onPhotoUpdated={fetchData}
                            onPhotoDeleted={fetchData}
                            onSetAsCover={() => handleSetAsCover(photo.id)}
                            isEditingTitle={editingPhotoId === photo.id}
                            editingTitle={editingPhotoTitle}
                            onStartEditingTitle={() => startEditingPhotoTitle(photo)}
                            onSaveTitle={savePhotoTitle}
                            onCancelEditing={cancelEditingPhotoTitle}
                            onEditingTitleChange={setEditingPhotoTitle}
                          />
                        </div>
                      </div>
                    </CardContent>
                   </Card>
                   );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Map - Hidden on mobile */}
        <div className="flex-1 hidden lg:block">
          {mapLocations.length > 0 ? (
            <PhotoMap
              locations={mapLocations}
              selectedLocationId={selectedPhotoId}
              onLocationClick={setSelectedPhotoId}
              className="w-full h-full"
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-muted/20">
              <div className="text-center">
                <MapPin className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucune photo géolocalisée</h3>
                <p className="text-muted-foreground">
                  Les photos de cette journée n'ont pas de données de localisation
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Description section */}
      <div className="border-t border-border bg-card/50">
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Récit de la journée</h3>
            <Button 
              onClick={saveDescription} 
              disabled={saving}
              size="sm"
              className="bg-gradient-sky hover:opacity-90"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </div>
          <Textarea
            value={dayDescription}
            onChange={(e) => setDayDescription(e.target.value)}
            placeholder="Racontez votre journée..."
            className="min-h-[120px] resize-none"
          />
        </div>
      </div>

      {/* Photo Modal */}
      <PhotoModal
        isOpen={!!modalPhoto}
        onClose={() => setModalPhoto(null)}
        photo={modalPhoto}
        albumTitle={album?.title || ''}
        dayTitle={dayEntry && calculateDayTitle(dayEntry, dayNumber)}
        photos={photos}
        onNavigate={(photoId) => {
          const photo = photos.find(p => p.id === photoId);
          if (photo) {
            setModalPhoto(photo);
          }
        }}
        onPhotoUpdate={() => {
          fetchData();
          // Refresh the current modal photo data if one is selected
          if (modalPhoto) {
            const updatedPhoto = photos.find(p => p.id === modalPhoto.id);
            if (updatedPhoto) {
              setModalPhoto(updatedPhoto);
            }
          }
        }}
      />
    </div>
  );
}