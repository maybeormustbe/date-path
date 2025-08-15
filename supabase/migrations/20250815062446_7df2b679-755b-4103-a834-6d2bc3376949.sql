-- Réinitialiser les titres qui sont identiques aux noms de lieux pour utiliser les titres par défaut
UPDATE day_entries 
SET title = NULL 
WHERE title = location_name;