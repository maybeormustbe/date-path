import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Upload, X, Image as ImageIcon, MapPin, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { parse } from 'exifr';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PhotoFile {
  file: File;
  id: string;
  preview: string;
  metadata?: {
    date?: Date;
    latitude?: number;
    longitude?: number;
    locationName?: string;
  };
}

interface PhotoUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  albumId: string;
  onUploadComplete: () => void;
}

export function PhotoUploadModal({ 
  open, 
  onOpenChange, 
  albumId, 
  onUploadComplete 
}: PhotoUploadModalProps) {
  const { user } = useAuth();
  const [files, setFiles] = useState<PhotoFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingMetadata, setProcessingMetadata] = useState(false);

  const createFileId = () => `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const processFileMetadata = async (file: File): Promise<PhotoFile['metadata']> => {
    try {
      const exifData = await parse(file);
      const metadata: PhotoFile['metadata'] = {};

      // Extract date
      if (exifData?.DateTimeOriginal || exifData?.DateTime || exifData?.CreateDate) {
        const dateStr = exifData.DateTimeOriginal || exifData.DateTime || exifData.CreateDate;
        metadata.date = new Date(dateStr);
      }

      // Extract GPS coordinates
      if (exifData?.latitude && exifData?.longitude) {
        metadata.latitude = parseFloat(exifData.latitude);
        metadata.longitude = parseFloat(exifData.longitude);
        
        // Try to get location name using reverse geocoding
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${metadata.latitude}&lon=${metadata.longitude}&zoom=14&addressdetails=1`
          );
          const locationData = await response.json();
          
          if (locationData?.display_name) {
            const parts = locationData.display_name.split(',');
            metadata.locationName = parts.slice(0, 2).join(', ').trim();
          }
        } catch (error) {
          console.warn('Erreur lors de la géolocalisation inverse:', error);
        }
      }

      return metadata;
    } catch (error) {
      console.warn('Erreur lors de l\'extraction des métadonnées EXIF:', error);
      return {};
    }
  };

  const handleFileSelect = useCallback(async (selectedFiles: FileList) => {
    setProcessingMetadata(true);
    const newFiles: PhotoFile[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} n'est pas une image valide`);
        continue;
      }

      const id = createFileId();
      const preview = URL.createObjectURL(file);
      
      const metadata = await processFileMetadata(file);
      
      newFiles.push({
        file,
        id,
        preview,
        metadata
      });
    }

    setFiles(prev => [...prev, ...newFiles]);
    setProcessingMetadata(false);
    
    if (newFiles.length > 0) {
      toast.success(`${newFiles.length} photo${newFiles.length !== 1 ? 's' : ''} ajoutée${newFiles.length !== 1 ? 's' : ''}`);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFileSelect(droppedFiles);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const removeFile = (fileId: string) => {
    setFiles(prev => {
      const fileToRemove = prev.find(f => f.id === fileId);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
  };

  const uploadFiles = async () => {
    if (files.length === 0 || !user) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const uploadPromises = files.map(async (photoFile, index) => {
        const fileExt = photoFile.file.name.split('.').pop();
        const fileName = `${user.id}/${albumId}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        
        // Upload to storage
        const { data: storageData, error: storageError } = await supabase.storage
          .from('photos')
          .upload(fileName, photoFile.file);

        if (storageError) throw storageError;

        // Create thumbnail (simple resize for now, could be enhanced)
        const thumbnailFileName = `${user.id}/${albumId}/thumb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        
        // For simplicity, we'll use the same file as thumbnail
        // In a real app, you'd resize the image first
        const { error: thumbnailError } = await supabase.storage
          .from('thumbnails')
          .upload(thumbnailFileName, photoFile.file);

        if (thumbnailError) console.warn('Erreur thumbnail:', thumbnailError);

        // Save to database
        const { data: photoData, error: dbError } = await supabase
          .from('photos')
          .insert({
            album_id: albumId,
            user_id: user.id,
            filename: photoFile.file.name,
            file_path: fileName,
            thumbnail_path: thumbnailFileName,
            taken_at: photoFile.metadata?.date?.toISOString(),
            latitude: photoFile.metadata?.latitude,
            longitude: photoFile.metadata?.longitude,
            location_name: photoFile.metadata?.locationName,
            file_size: photoFile.file.size,
            mime_type: photoFile.file.type,
            title: photoFile.metadata?.locationName || photoFile.file.name.replace(/\.[^/.]+$/, "")
          })
          .select()
          .single();

        if (dbError) throw dbError;

        // Create or update day entry for this photo
        if (photoFile.metadata?.date) {
          const photoDate = photoFile.metadata.date.toISOString().split('T')[0]; // YYYY-MM-DD format
          
          // Check if day entry already exists
          const { data: existingDay } = await supabase
            .from('day_entries')
            .select('id')
            .eq('album_id', albumId)
            .eq('date', photoDate)
            .single();

          if (!existingDay) {
            // Create new day entry
            await supabase
              .from('day_entries')
              .insert({
                album_id: albumId,
                user_id: user.id,
                date: photoDate,
                title: photoFile.metadata.locationName || `Photos du ${new Date(photoDate).toLocaleDateString('fr-FR')}`,
                latitude: photoFile.metadata.latitude,
                longitude: photoFile.metadata.longitude,
                location_name: photoFile.metadata.locationName,
                cover_photo_id: photoData.id
              });
          }
        }

        // Update progress
        const progress = ((index + 1) / files.length) * 100;
        setUploadProgress(progress);
      });

      await Promise.all(uploadPromises);
      
      toast.success(`${files.length} photo${files.length !== 1 ? 's' : ''} uploadée${files.length !== 1 ? 's' : ''} avec succès`);
      
      // Clean up
      files.forEach(file => URL.revokeObjectURL(file.preview));
      setFiles([]);
      onUploadComplete();
      onOpenChange(false);
      
    } catch (error) {
      console.error('Erreur upload:', error);
      toast.error('Erreur lors de l\'upload des photos');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const formatMetadata = (metadata?: PhotoFile['metadata']) => {
    if (!metadata) return 'Aucune métadonnée';
    
    const parts = [];
    
    if (metadata.date) {
      parts.push(format(metadata.date, 'dd MMMM yyyy à HH:mm', { locale: fr }));
    }
    
    if (metadata.locationName) {
      parts.push(metadata.locationName);
    } else if (metadata.latitude && metadata.longitude) {
      parts.push(`${metadata.latitude.toFixed(4)}, ${metadata.longitude.toFixed(4)}`);
    }
    
    return parts.length > 0 ? parts.join(' • ') : 'Aucune métadonnée';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Ajouter des photos</DialogTitle>
          <DialogDescription>
            Glissez-déposez vos photos ou cliquez pour les sélectionner. Les métadonnées de date et lieu seront automatiquement extraites.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Upload Area */}
          <div
            className="border-2 border-dashed border-muted-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.multiple = true;
              input.accept = 'image/*';
              input.onchange = (e) => {
                const files = (e.target as HTMLInputElement).files;
                if (files) handleFileSelect(files);
              };
              input.click();
            }}
          >
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Sélectionnez vos photos</h3>
            <p className="text-muted-foreground mb-4">
              Glissez-déposez vos fichiers ici ou cliquez pour parcourir
            </p>
            <p className="text-sm text-muted-foreground">
              Formats supportés: JPG, PNG, HEIC, etc.
            </p>
          </div>

          {processingMetadata && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Extraction des métadonnées...</p>
            </div>
          )}

          {/* File List */}
          {files.length > 0 && (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {files.map((photoFile) => (
                  <div key={photoFile.id} className="bg-card border border-card-border rounded-lg p-4">
                    <div className="flex gap-3">
                      <img
                        src={photoFile.preview}
                        alt="Preview"
                        className="w-20 h-20 object-cover rounded-md flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-sm truncate">{photoFile.file.name}</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeFile(photoFile.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" />
                            <span>{(photoFile.file.size / 1024 / 1024).toFixed(1)} MB</span>
                          </div>
                          
                          {photoFile.metadata?.date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{format(photoFile.metadata.date, 'dd/MM/yyyy HH:mm')}</span>
                            </div>
                          )}
                          
                          {(photoFile.metadata?.locationName || (photoFile.metadata?.latitude && photoFile.metadata?.longitude)) && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">
                                {photoFile.metadata.locationName || 
                                 `${photoFile.metadata.latitude?.toFixed(4)}, ${photoFile.metadata.longitude?.toFixed(4)}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Upload en cours...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end border-t border-border pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
              Annuler
            </Button>
            <Button 
              onClick={uploadFiles} 
              disabled={files.length === 0 || uploading || processingMetadata}
              className="bg-gradient-sky hover:opacity-90"
            >
              {uploading ? 'Upload...' : `Uploader ${files.length} photo${files.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}