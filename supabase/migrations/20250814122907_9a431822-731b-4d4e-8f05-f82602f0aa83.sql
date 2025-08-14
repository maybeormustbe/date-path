-- Créer les day_entries manquantes à partir des photos existantes
INSERT INTO public.day_entries (album_id, user_id, date, title, latitude, longitude, location_name, cover_photo_id)
SELECT DISTINCT 
    p.album_id,
    p.user_id,
    DATE(p.taken_at) as date,
    COALESCE(p.location_name, 'Photos du ' || TO_CHAR(DATE(p.taken_at), 'DD/MM/YYYY')) as title,
    p.latitude,
    p.longitude,
    p.location_name,
    (SELECT p2.id FROM photos p2 WHERE DATE(p2.taken_at) = DATE(p.taken_at) AND p2.album_id = p.album_id ORDER BY p2.taken_at DESC LIMIT 1) as cover_photo_id
FROM photos p 
WHERE p.taken_at IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM day_entries de 
    WHERE de.album_id = p.album_id 
    AND de.date = DATE(p.taken_at)
);