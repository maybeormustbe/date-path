-- Créer les day_entries manquantes pour l'album problématique
WITH photo_days AS (
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
    AND p.album_id = '29b0386e-3ec3-4a7f-b599-f6aab4abd8f9'
)
INSERT INTO public.day_entries (album_id, user_id, date, title, latitude, longitude, location_name, cover_photo_id)
SELECT album_id, user_id, date, title, latitude, longitude, location_name, cover_photo_id
FROM photo_days
WHERE NOT EXISTS (
    SELECT 1 FROM day_entries de 
    WHERE de.album_id = photo_days.album_id 
    AND de.date = photo_days.date
);