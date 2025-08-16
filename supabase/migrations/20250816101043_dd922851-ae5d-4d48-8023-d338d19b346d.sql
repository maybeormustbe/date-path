-- Rendre le bucket photos public pour permettre l'affichage des images
UPDATE storage.buckets 
SET public = true 
WHERE id = 'photos';

-- Créer seulement la politique pour permettre l'accès public en lecture aux photos
CREATE POLICY "Photos are publicly viewable" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'photos');