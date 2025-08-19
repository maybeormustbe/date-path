-- Add is_favorite column to photos table
ALTER TABLE public.photos 
ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT false;