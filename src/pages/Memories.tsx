import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Play, Pause, Calendar, MapPin, Image, Book } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface MemoryPhoto {
  id: string;
  title: string | null;
  file_path: string;
  taken_at: string | null;
  location_name: string | null;
  album_title: string;
  day_title: string | null;
  date: string;
}

export default function Memories() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<MemoryPhoto[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchRandomPhotos = useCallback(async () => {
    if (!user) return;

    try {
      // Récupérer toutes les photos de l'utilisateur
      const { data, error } = await supabase
        .from('photos')
        .select(`
          id,
          title,
          file_path,
          taken_at,
          location_name,
          album_id
        `)
        .eq('user_id', user.id)
        .order('taken_at', { ascending: false });

      if (error) throw error;

      // Ensuite récupérer les informations des albums et day_entries
      const photosWithDetails = await Promise.all(
        data.map(async (photo) => {
          const [albumResult, dayEntryResult] = await Promise.all([
            supabase
              .from('albums')
              .select('title')
              .eq('id', photo.album_id)
              .single(),
            supabase
              .from('day_entries')
              .select('title, date')
              .eq('album_id', photo.album_id)
              .eq('date', photo.taken_at ? new Date(photo.taken_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
              .maybeSingle()
          ]);

          return {
            id: photo.id,
            title: photo.title,
            file_path: photo.file_path,
            taken_at: photo.taken_at,
            location_name: photo.location_name,
            album_title: albumResult.data?.title || 'Album sans titre',
            day_title: dayEntryResult.data?.title || null,
            date: dayEntryResult.data?.date || (photo.taken_at ? new Date(photo.taken_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
          };
        })
      );

      // Mélanger les photos aléatoirement
      const shuffledPhotos = photosWithDetails.sort(() => Math.random() - 0.5);
      setPhotos(shuffledPhotos);
      console.log(`Nombre total de photos chargées: ${shuffledPhotos.length}`);
    } catch (error) {
      console.error('Erreur lors du chargement des photos:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRandomPhotos();
  }, [fetchRandomPhotos]);

  useEffect(() => {
    if (!isPlaying || photos.length === 0) return;

    const interval = setInterval(() => {
      setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
    }, 15000);

    return () => clearInterval(interval);
  }, [isPlaying, photos.length]);

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement des souvenirs...</p>
        </div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-8">
            <Image className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Aucune photo trouvée</h2>
            <p className="text-muted-foreground mb-4">
              Ajoutez des photos à vos albums pour créer des souvenirs.
            </p>
            <Button onClick={() => navigate('/')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour aux albums
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPhoto = photos[currentPhotoIndex];
  const photoUrl = `https://rkpxhfigmeqicnxfvbyr.supabase.co/storage/v1/object/public/photos/${currentPhoto.file_path}`;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center justify-between p-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <h1 className="text-xl font-semibold">Souvenirs</h1>
          <div className="w-16" /> {/* Spacer */}
        </div>
      </header>

      {/* Main photo display */}
      <div className="relative h-screen flex items-center justify-center">
        <img
          src={photoUrl}
          alt={currentPhoto.title || 'Photo souvenir'}
          className="max-h-full max-w-full object-contain"
          loading="lazy"
        />
        
        {/* Photo info overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
          <div className="p-6 space-y-3">
            <div className="flex items-center gap-4 text-sm text-white/80">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>
                  {currentPhoto.taken_at 
                    ? format(new Date(currentPhoto.taken_at), 'dd MMMM yyyy', { locale: fr })
                    : format(new Date(currentPhoto.date), 'dd MMMM yyyy', { locale: fr })
                  }
                </span>
              </div>
              {currentPhoto.location_name && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{currentPhoto.location_name}</span>
                </div>
              )}
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-white">
                <Book className="h-4 w-4" />
                <span className="font-medium">{currentPhoto.album_title}</span>
              </div>
              
              {currentPhoto.day_title && (
                <p className="text-white/90 text-sm ml-6">
                  {currentPhoto.day_title}
                </p>
              )}
              
              {currentPhoto.title && (
                <p className="text-white/90 text-sm ml-6 italic">
                  "{currentPhoto.title}"
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-sm text-white/60">
                {currentPhotoIndex + 1} / {photos.length}
              </div>
              <span className="text-sm text-white/60">
                {isPlaying ? 'Lecture automatique' : 'En pause'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-sm rounded-full px-6 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={prevPhoto}
          className="text-white hover:bg-white/20 rounded-full"
        >
          ←
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={togglePlayPause}
          className="text-white hover:bg-white/20 rounded-full w-12 h-12"
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={nextPhoto}
          className="text-white hover:bg-white/20 rounded-full"
        >
          →
        </Button>
      </div>
    </div>
  );
}