-- Rendre le bucket photos public pour permettre l'affichage des images
UPDATE storage.buckets 
SET public = true 
WHERE id = 'photos';

-- Créer les politiques pour permettre l'accès public en lecture aux photos des utilisateurs authentifiés
CREATE POLICY "Photos are publicly viewable" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'photos');

-- S'assurer que les utilisateurs peuvent toujours uploader leurs propres photos
CREATE POLICY "Users can upload their own photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- S'assurer que les utilisateurs peuvent mettre à jour leurs propres photos
CREATE POLICY "Users can update their own photos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- S'assurer que les utilisateurs peuvent supprimer leurs propres photos
CREATE POLICY "Users can delete their own photos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'photos' AND auth.uid()::text = (storage.foldername(name))[1]);