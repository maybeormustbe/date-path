import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Heart, Trash2, Edit3, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  photo: {
    id: string;
    title: string | null;
    file_path: string;
    is_favorite: boolean;
  } | null;
  albumTitle: string;
  dayTitle: string;
  photos: Array<{
    id: string;
    title: string | null;
    file_path: string;
    is_favorite: boolean;
  }>;
  onNavigate: (photoId: string) => void;
  onPhotoUpdate: () => void;
}

export const PhotoModal = ({ isOpen, onClose, photo, albumTitle, dayTitle, photos, onNavigate, onPhotoUpdate }: PhotoModalProps) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState<string>('');
  const { toast } = useToast();
  
  useEffect(() => {
    if (photo) {
      setEditTitle(photo.title || '');
    }
  }, [photo]);

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

  const handleUpdateTitle = async () => {
    if (!photo) return;
    
    try {
      const { error } = await supabase
        .from('photos')
        .update({ title: editTitle || null })
        .eq('id', photo.id);

      if (error) throw error;

      // Update local photo object to reflect changes immediately
      photo.title = editTitle || null;

      toast({
        title: "Titre mis à jour",
        description: "Le titre de la photo a été modifié avec succès."
      });

      setIsEditing(false);
      onPhotoUpdate();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du titre:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le titre.",
        variant: "destructive"
      });
    }
  };

  const handleToggleFavorite = async () => {
    if (!photo) return;
    
    try {
      const { error } = await supabase
        .from('photos')
        .update({ is_favorite: !photo.is_favorite })
        .eq('id', photo.id);

      if (error) throw error;

      toast({
        title: photo.is_favorite ? "Retiré des favoris" : "Ajouté aux favoris",
        description: photo.is_favorite 
          ? "La photo a été retirée des favoris." 
          : "La photo a été ajoutée aux favoris."
      });

      // Update local photo object to reflect changes immediately
      photo.is_favorite = !photo.is_favorite;

      onPhotoUpdate();
    } catch (error) {
      console.error('Erreur lors de la mise à jour des favoris:', error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier le statut favori.",
        variant: "destructive"
      });
    }
  };

  const handleDeletePhoto = async () => {
    if (!photo) return;
    
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette photo ? Cette action est irréversible.')) {
      return;
    }
    
    try {
      // Déterminer la photo à afficher après suppression
      const currentIndex = photos.findIndex(p => p.id === photo.id);
      let nextPhotoId: string | null = null;
      
      if (photos.length > 1) {
        if (currentIndex > 0) {
          // Afficher la photo précédente
          nextPhotoId = photos[currentIndex - 1].id;
        } else if (currentIndex < photos.length - 1) {
          // Si c'est la première photo, afficher la suivante
          nextPhotoId = photos[currentIndex + 1].id;
        }
      }

      // Supprimer le fichier du storage
      const { error: storageError } = await supabase.storage
        .from('photos')
        .remove([photo.file_path]);

      if (storageError) {
        console.warn('Erreur lors de la suppression du fichier:', storageError);
      }

      // Supprimer l'entrée de la base de données
      const { error: dbError } = await supabase
        .from('photos')
        .delete()
        .eq('id', photo.id);

      if (dbError) throw dbError;

      toast({
        title: "Photo supprimée",
        description: "La photo a été supprimée avec succès."
      });

      // Naviguer vers la photo suivante ou fermer la modale
      if (nextPhotoId) {
        onNavigate(nextPhotoId);
      } else {
        onClose();
      }
      
      onPhotoUpdate();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la photo.",
        variant: "destructive"
      });
    }
  };

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
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">{albumTitle}</div>
              <div className="text-sm text-muted-foreground">{dayTitle}</div>
              
              {/* Titre éditable */}
              <div className="flex items-center justify-center gap-2">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Titre de la photo"
                      className="text-center"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateTitle();
                        if (e.key === 'Escape') {
                          setIsEditing(false);
                          setEditTitle(photo.title || '');
                        }
                      }}
                    />
                    <Button size="sm" onClick={handleUpdateTitle}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => {
                        setIsEditing(false);
                        setEditTitle(photo.title || '');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>{photo.title || 'Photo sans titre'}</span>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex items-center justify-center gap-4 pt-2">
                <Button
                  size="sm"
                  variant={photo.is_favorite ? "default" : "outline"}
                  onClick={handleToggleFavorite}
                  className="flex items-center gap-2"
                >
                  <Heart className={`h-4 w-4 ${photo.is_favorite ? 'fill-current' : ''}`} />
                  {photo.is_favorite ? 'Favori' : 'Ajouter aux favoris'}
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDeletePhoto}
                  className="flex items-center gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </Button>
              </div>
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