-- Create function to get day entries with photo count
CREATE OR REPLACE FUNCTION get_day_entries_with_photo_count(album_id uuid)
RETURNS TABLE (
  id uuid,
  date date,
  title text,
  location_name text,
  latitude numeric,
  longitude numeric,
  cover_photo_id uuid,
  photo_count bigint,
  cover_photo_thumbnail_path text,
  cover_photo_file_path text,
  cover_photo_title text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    de.id,
    de.date,
    de.title,
    de.location_name,
    de.latitude,
    de.longitude,
    de.cover_photo_id,
    COALESCE(pc.photo_count, 0) as photo_count,
    cp.thumbnail_path as cover_photo_thumbnail_path,
    cp.file_path as cover_photo_file_path,
    cp.title as cover_photo_title
  FROM day_entries de
  LEFT JOIN (
    SELECT 
      taken_at::date as photo_date,
      COUNT(*) as photo_count
    FROM photos 
    WHERE photos.album_id = get_day_entries_with_photo_count.album_id
    GROUP BY taken_at::date
  ) pc ON de.date = pc.photo_date
  LEFT JOIN photos cp ON de.cover_photo_id = cp.id
  WHERE de.album_id = get_day_entries_with_photo_count.album_id
  ORDER BY de.date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;