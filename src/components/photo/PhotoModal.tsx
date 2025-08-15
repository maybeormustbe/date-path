import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  photo: {
    id: string;
    title: string | null;
    file_path: string;
  } | null;
  albumTitle: string;
  dayTitle: string;
  photos: Array<{
    id: string;
    title: string | null;
    file_path: string;
  }>;
  onNavigate: (photoId: string) => void;
}

export const PhotoModal = ({ isOpen, onClose, photo, albumTitle, dayTitle, photos, onNavigate }: PhotoModalProps) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  
  useEffect(() => {
    const getSignedUrl = async () => {
      if (!photo) return;
      
      try {
        const { data, error } = await supabase.storage
          .from('photos')
          .createSignedUrl(photo.file_path, 3600); // 1 hour expiry
        
        if (error) {
          console.error('Erreur lors de la génération de l\'URL signée:', error);
          return;
        }
        
        setImageUrl(data.signedUrl);
      } catch (error) {
        console.error('Erreur:', error);
      }
    };
    
    if (isOpen && photo) {
      getSignedUrl();
    }
  }, [isOpen, photo]);

  if (!photo) return null;

  const currentIndex = photos.findIndex(p => p.id === photo.id);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;

  const goToPrevious = () => {
    if (hasPrevious) {
      onNavigate(photos[currentIndex - 1].id);
    }
  };

  const goToNext = () => {
    if (hasNext) {
      onNavigate(photos[currentIndex + 1].id);
    }
  };

  

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-hidden z-[9999]">
        <DialogHeader>
          <DialogTitle className="text-center">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">{albumTitle}</div>
              <div className="text-sm text-muted-foreground">{dayTitle}</div>
              <div>{photo.title || 'Photo sans titre'}</div>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="relative flex justify-center items-center max-h-[70vh] overflow-hidden">
          {/* Bouton précédent */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/20 hover:bg-black/40 text-white"
            onClick={goToPrevious}
            disabled={!hasPrevious}
            style={{ opacity: hasPrevious ? 1 : 0.3 }}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <img
            src={imageUrl}
            alt={photo.title || 'Photo'}
            className="max-w-full max-h-full object-contain rounded-md"
            onError={(e) => {
              console.error('Erreur de chargement de l\'image:', imageUrl);
            }}
          />

          {/* Bouton suivant */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/20 hover:bg-black/40 text-white"
            onClick={goToNext}
            disabled={!hasNext}
            style={{ opacity: hasNext ? 1 : 0.3 }}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>

          {/* Indicateur de position */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
            {currentIndex + 1} / {photos.length}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};