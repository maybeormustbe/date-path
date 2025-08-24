import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Plus, Calendar, MapPin, MoreVertical, Edit, Trash, LogOut, Camera, Heart, Menu } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Album {
  id: string;
  title: string;
  description: string | null;
  year: number;
  month: number;
  created_at: string;
  photo_count?: number;
}

export function AlbumList() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [newAlbumDescription, setNewAlbumDescription] = useState('');

  useEffect(() => {
    if (user) {
      fetchAlbums();
    }
  }, [user]);

  const fetchAlbums = async () => {
    try {
      const { data, error } = await supabase
        .from('albums')
        .select(`
          id,
          title,
          description,
          year,
          month,
          created_at,
          photos (count)
        `)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) throw error;

      const albumsWithCounts = data.map(album => ({
        ...album,
        photo_count: album.photos?.[0]?.count || 0
      }));

      setAlbums(albumsWithCounts);
    } catch (error) {
      console.error('Erreur lors du chargement des albums:', error);
      toast.error('Erreur lors du chargement des albums');
    } finally {
      setLoading(false);
    }
  };

  const createAlbum = async () => {
    if (!newAlbumTitle.trim()) {
      toast.error('Le titre est requis');
      return;
    }

    try {
      const now = new Date();
      const { error } = await supabase
        .from('albums')
        .insert({
          title: newAlbumTitle,
          description: newAlbumDescription || null,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          user_id: user!.id
        });

      if (error) throw error;

      toast.success('Album créé avec succès');
      setCreateDialogOpen(false);
      setNewAlbumTitle('');
      setNewAlbumDescription('');
      fetchAlbums();
    } catch (error) {
      console.error('Erreur lors de la création:', error);
      toast.error('Erreur lors de la création de l\'album');
    }
  };

  const updateAlbum = async () => {
    if (!editingAlbum || !newAlbumTitle.trim()) return;

    try {
      const { error } = await supabase
        .from('albums')
        .update({
          title: newAlbumTitle,
          description: newAlbumDescription || null
        })
        .eq('id', editingAlbum.id);

      if (error) throw error;

      toast.success('Album modifié avec succès');
      setEditDialogOpen(false);
      setEditingAlbum(null);
      setNewAlbumTitle('');
      setNewAlbumDescription('');
      fetchAlbums();
    } catch (error) {
      console.error('Erreur lors de la modification:', error);
      toast.error('Erreur lors de la modification de l\'album');
    }
  };

  const deleteAlbum = async (albumId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet album ? Cette action est irréversible.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('albums')
        .delete()
        .eq('id', albumId);

      if (error) throw error;

      toast.success('Album supprimé avec succès');
      fetchAlbums();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error('Erreur lors de la suppression de l\'album');
    }
  };

  const openEditDialog = (album: Album) => {
    setEditingAlbum(album);
    setNewAlbumTitle(album.title);
    setNewAlbumDescription(album.description || '');
    setEditDialogOpen(true);
  };

  const getMonthName = (month: number) => {
    const date = new Date(2000, month - 1, 1);
    return format(date, 'MMMM', { locale: fr });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement de vos albums...</p>
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
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Camera className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">PhotoAlbum</h1>
                <p className="text-sm text-muted-foreground">Mes Albums</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {isMobile ? (
                // Menu mobile unique
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="z-[9999] bg-background border border-border shadow-lg">
                    <DropdownMenuItem onClick={() => navigate('/memories')}>
                      <Heart className="h-4 w-4 mr-2" />
                      Souvenirs
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCreateDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nouvel Album
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={signOut}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Déconnexion
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                // Boutons desktop
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/memories')}
                    className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 border-pink-500/20 hover:from-pink-500/20 hover:to-purple-500/20"
                  >
                    <Heart className="h-4 w-4 mr-2" />
                    Souvenirs
                  </Button>
                  
                  <Button 
                    onClick={() => setCreateDialogOpen(true)}
                    className="bg-gradient-sky hover:opacity-90"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nouvel Album
                  </Button>
                  
                  <Button variant="outline" onClick={signOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Déconnexion
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {albums.length === 0 ? (
          <div className="text-center py-16">
            <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Camera className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Aucun album trouvé</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Créez votre premier album photo pour commencer à organiser vos souvenirs par lieux et dates.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} className="bg-gradient-sky hover:opacity-90">
              <Plus className="h-4 w-4 mr-2" />
              Créer mon premier album
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {albums.map((album) => (
              <Card 
                key={album.id} 
                className="hover:shadow-medium transition-all duration-200 cursor-pointer border-card-border group"
                onClick={() => navigate(`/album/${album.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate group-hover:text-primary transition-colors">
                        {album.title}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{getMonthName(album.month)} {album.year}</span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(album);
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteAlbum(album.id);
                          }}
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  {album.description && (
                    <CardDescription className="mb-3 line-clamp-2">
                      {album.description}
                    </CardDescription>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{album.photo_count || 0} photo{(album.photo_count || 0) !== 1 ? 's' : ''}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create Album Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un nouvel album</DialogTitle>
            <DialogDescription>
              Ajoutez un titre et une description pour votre nouvel album
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titre</Label>
              <Input
                id="title"
                placeholder="Nom de l'album"
                value={newAlbumTitle}
                onChange={(e) => setNewAlbumTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optionnel)</Label>
              <Input
                id="description"
                placeholder="Description de l'album"
                value={newAlbumDescription}
                onChange={(e) => setNewAlbumDescription(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={createAlbum} className="bg-gradient-sky hover:opacity-90">
                Créer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'album</DialogTitle>
            <DialogDescription>
              Modifiez le titre et la description de votre album
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Titre</Label>
              <Input
                id="edit-title"
                placeholder="Nom de l'album"
                value={newAlbumTitle}
                onChange={(e) => setNewAlbumTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (optionnel)</Label>
              <Input
                id="edit-description"
                placeholder="Description de l'album"
                value={newAlbumDescription}
                onChange={(e) => setNewAlbumDescription(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={updateAlbum} className="bg-gradient-earth hover:opacity-90">
                Sauvegarder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}