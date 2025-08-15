import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
}

export const PhotoModal = ({ isOpen, onClose, photo, albumTitle, dayTitle }: PhotoModalProps) => {
  if (!photo) return null;

  const imageUrl = supabase.storage.from('photos').getPublicUrl(photo.file_path).data.publicUrl;

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
        
        <div className="flex justify-center items-center max-h-[70vh] overflow-hidden">
          <img
            src={imageUrl}
            alt={photo.title || 'Photo'}
            className="max-w-full max-h-full object-contain rounded-md"
            onError={(e) => {
              console.error('Erreur de chargement de l\'image:', imageUrl);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};