-- Insérer les day_entries une par une pour éviter les conflits
INSERT INTO day_entries (album_id, user_id, date, title, latitude, longitude, location_name, cover_photo_id)
VALUES 
  ('29b0386e-3ec3-4a7f-b599-f6aab4abd8f9', '7ea68d07-9e3f-4086-9e86-bbf90fc61af7', '2025-07-13', 'Herlin, Bangor', 47.29650000, -3.15973611, 'Herlin, Bangor', 'd476cdaa-75d0-481e-b9ae-e877e6bcfbc7'),
  ('29b0386e-3ec3-4a7f-b599-f6aab4abd8f9', '7ea68d07-9e3f-4086-9e86-bbf90fc61af7', '2025-07-14', 'Kérel, Bangor', 47.29965278, -3.20269444, 'Kérel, Bangor', '4b9c91fb-8c57-477f-9eaa-06f26abd06a8'),
  ('29b0386e-3ec3-4a7f-b599-f6aab4abd8f9', '7ea68d07-9e3f-4086-9e86-bbf90fc61af7', '2025-07-18', 'Le Champ Foin, Locmaria', 47.29039722, -3.12604444, 'Le Champ Foin, Locmaria', 'b49b44ff-80ae-4400-ac4f-8762d69af66a'),
  ('29b0386e-3ec3-4a7f-b599-f6aab4abd8f9', '7ea68d07-9e3f-4086-9e86-bbf90fc61af7', '2025-07-20', 'Le Grand Village, Bangor', 47.29506667, -3.19128056, 'Le Grand Village, Bangor', '4b340579-e39b-4a28-a3b2-63c70eadca38'),
  ('29b0386e-3ec3-4a7f-b599-f6aab4abd8f9', '7ea68d07-9e3f-4086-9e86-bbf90fc61af7', '2025-07-21', 'Anterre, Sauzon', 47.32465000, -3.23693611, 'Anterre, Sauzon', '4b340579-e39b-4a28-a3b2-63c70eadca38'),
  ('29b0386e-3ec3-4a7f-b599-f6aab4abd8f9', '7ea68d07-9e3f-4086-9e86-bbf90fc61af7', '2025-07-23', 'France métropolitaine, France', 47.43466944, -3.12710556, 'France métropolitaine, France', 'b49b44ff-80ae-4400-ac4f-8762d69af66a')
ON CONFLICT (album_id, date) DO NOTHING;