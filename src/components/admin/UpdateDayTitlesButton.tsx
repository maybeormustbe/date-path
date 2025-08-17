import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export const UpdateDayTitlesButton = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const handleUpdateTitles = async () => {
    setIsUpdating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('update-day-titles', {
        body: {}
      });

      if (error) {
        console.error('Erreur lors de la mise à jour des titres:', error);
        toast({
          title: "Erreur",
          description: "Impossible de mettre à jour les titres des journées",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Succès",
        description: data.message || "Titres des journées mis à jour avec succès",
      });

      // Recharger la page pour voir les changements
      window.location.reload();

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
      onClick={handleUpdateTitles} 
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
        'Mettre à jour les titres'
      )}
    </Button>
  );
};