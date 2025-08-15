import React, { useState } from 'react';
import { MoreVertical, Edit, Trash2, Eye, Image } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PhotoActionsProps {
  photo: {
    id: string;
    title: string | null;
    file_path: string;
  };
  onPhotoUpdated: () => void;
  onPhotoDeleted: () => void;
  onViewPhoto: () => void;
  onSetAsCover: () => void;
}

export const PhotoActions = ({ 
  photo, 
  onPhotoUpdated, 
  onPhotoDeleted, 
  onViewPhoto, 
  onSetAsCover 
}: PhotoActionsProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [newTitle, setNewTitle] = useState(photo.title || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEditTitle = async () => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('photos')
        .update({ title: newTitle || null })
        .eq('id', photo.id);

      if (error) throw error;
      
      toast.success('Titre modifié');
      setShowEditDialog(false);
      onPhotoUpdated();
    } catch (error) {
      console.error('Erreur lors de la modification du titre:', error);
      toast.error('Erreur lors de la modification');
    } finally {
      setIsUpdating(false);
    }
  };

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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Modifier le titre
          </DropdownMenuItem>
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

      {/* Edit Title Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le titre de la photo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Titre de la photo"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleEditTitle();
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Annuler
              </Button>
              <Button onClick={handleEditTitle} disabled={isUpdating}>
                {isUpdating ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
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