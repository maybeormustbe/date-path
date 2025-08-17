import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin } from 'lucide-react';

interface UpdateAlbumMetadataButtonProps {
  albumId: string;
}

export const UpdateAlbumMetadataButton = ({ albumId }: UpdateAlbumMetadataButtonProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const handleUpdateMetadata = async () => {
    setIsUpdating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('update-album-metadata', {
        body: { albumId }
      });

      if (error) {
        console.error('Erreur lors de la mise à jour des métadonnées:', error);
        toast({
          title: "Erreur",
          description: "Impossible de mettre à jour les métadonnées de l'album",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Succès",
        description: `${data.photosUpdated} photos et ${data.dayEntriesUpdated} journées mises à jour`,
      });

      // Recharger la page pour voir les changements
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: "Erreur",
        description: "Une erreur inattendue s'est produite",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Button 
      onClick={handleUpdateMetadata} 
      disabled={isUpdating}
      variant="outline"
      size="sm"
    >
      {isUpdating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Mise à jour...
        </>
      ) : (
        <>
          <MapPin className="mr-2 h-4 w-4" />
          Coordonnées & lieux
        </>
      )}
    </Button>
  );
};