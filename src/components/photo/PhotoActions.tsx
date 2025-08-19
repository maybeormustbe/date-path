import React, { useState } from 'react';
import { MoreVertical, Edit2, Trash2, Eye, Image, Check, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PhotoActionsProps {
  photo: {
    id: string;
    title: string | null;
    file_path: string;
    is_favorite: boolean;
  };
  onPhotoUpdated: () => void;
  onPhotoDeleted: () => void;
  onViewPhoto: () => void;
  onSetAsCover: () => void;
  isEditingTitle?: boolean;
  editingTitle?: string;
  onStartEditingTitle?: () => void;
  onSaveTitle?: () => void;
  onCancelEditing?: () => void;
  onEditingTitleChange?: (value: string) => void;
}

export const PhotoActions = ({ 
  photo, 
  onPhotoUpdated, 
  onPhotoDeleted, 
  onViewPhoto, 
  onSetAsCover,
  isEditingTitle = false,
  editingTitle = '',
  onStartEditingTitle,
  onSaveTitle,
  onCancelEditing,
  onEditingTitleChange
}: PhotoActionsProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeletePhoto = async () => {
    setIsDeleting(true);
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('photos')
        .remove([photo.file_path]);

      if (storageError) {
        console.warn('Erreur lors de la suppression du fichier:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('photos')
        .delete()
        .eq('id', photo.id);

      if (dbError) throw dbError;
      
      toast.success('Photo supprimée');
      setShowDeleteDialog(false);
      onPhotoDeleted();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  // Si on est en mode édition en ligne, afficher les boutons d'édition
  if (isEditingTitle && onSaveTitle && onCancelEditing) {
    return (
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onSaveTitle}
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onCancelEditing}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-1 group-hover:opacity-100 opacity-0 transition-opacity">
        {/* Bouton d'édition inline qui apparaît au survol */}
        {onStartEditingTitle && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onStartEditingTitle}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        )}
        
        {/* Menu dropdown pour les autres actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-[9999] bg-background">
            <DropdownMenuItem onClick={onViewPhoto}>
              <Eye className="h-4 w-4 mr-2" />
              Voir en grand
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSetAsCover}>
              <Image className="h-4 w-4 mr-2" />
              Miniature du jour
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="z-[9999]">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la photo</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette photo ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePhoto} disabled={isDeleting}>
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};