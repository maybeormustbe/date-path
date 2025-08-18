import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Album {
  id: string;
  title: string;
  description: string | null;
  year: number;
  month: number;
}

interface DayEntry {
  id: string;
  date: string;
  title: string | null;
  description: string | null;
  location_name: string | null;
  cover_photo?: {
    file_path: string;
    title: string;
  };
}

export default function AlbumPrint() {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [album, setAlbum] = useState<Album | null>(null);
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (albumId && user) {
      fetchPrintData();
    }
  }, [albumId, user]);

  const fetchPrintData = async () => {
    try {
      // Fetch album info
      const { data: albumData, error: albumError } = await supabase
        .from('albums')
        .select('*')
        .eq('id', albumId)
        .single();

      if (albumError) throw albumError;
      setAlbum(albumData);

      // Fetch day entries with cover photos and descriptions
      const { data: dayData, error: dayError } = await supabase.rpc('get_day_entries_with_photo_count', {
        album_id: albumId
      });

      if (dayError && dayError.code !== 'PGRST116') throw dayError;

      // Filter only days with actual content (photos > 0)
      const daysWithContent = (dayData || [])
        .filter((day: any) => day.photo_count > 0)
        .map((day: any) => ({
          id: day.id,
          date: day.date,
          title: day.title,
          description: '', // Will be fetched separately
          location_name: day.location_name,
          cover_photo: day.cover_photo_file_path ? {
            file_path: day.cover_photo_file_path,
            title: day.cover_photo_title
          } : null
        }));

      // Fetch descriptions for each day entry
      const { data: dayDescriptions, error: descError } = await supabase
        .from('day_entries')
        .select('id, description')
        .eq('album_id', albumId);

      if (descError) throw descError;

      // Merge descriptions
      const daysWithDescriptions = daysWithContent.map((day: any) => {
        const dayDesc = dayDescriptions?.find(d => d.id === day.id);
        return {
          ...day,
          description: dayDesc?.description || null
        };
      });

      setDayEntries(daysWithDescriptions);

    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Album non trouvé</h2>
          <Button onClick={() => navigate('/')}>Retour aux albums</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header - hidden when printing */}
      <header className="bg-card border-b border-card-border shadow-soft print:hidden">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate(`/album/${albumId}`)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour à l'album
              </Button>
              <div>
                <h1 className="text-xl font-bold">Impression - {album.title}</h1>
                <p className="text-sm text-muted-foreground">
                  {dayEntries.length} journée{dayEntries.length !== 1 ? 's' : ''} avec contenu
                </p>
              </div>
            </div>
            <Button onClick={handlePrint} className="bg-gradient-sky hover:opacity-90">
              <Printer className="h-4 w-4 mr-2" />
              Imprimer
            </Button>
          </div>
        </div>
      </header>

      {/* Print content */}
      <div className="print-container">
        {/* Album title page */}
        <div className="album-title-page">
          <div className="text-center">
            <h1 className="album-main-title">{album.title}</h1>
            {album.description && (
              <p className="album-description">{album.description}</p>
            )}
            <p className="album-date">{album.month}/{album.year}</p>
          </div>
        </div>

        {/* Day entries - 2 per page */}
        <div className="days-grid">
          {dayEntries.map((day, index) => (
            <div key={day.id} className="day-entry">
              <div className="day-content">
                {/* Date and location */}
                <div className="day-header">
                  <h2 className="day-title">
                    {day.title || format(new Date(day.date), 'EEEE d MMMM yyyy', { locale: fr })}
                  </h2>
                  {day.location_name && (
                    <p className="day-location">{day.location_name}</p>
                  )}
                </div>

                {/* Cover photo */}
                {day.cover_photo && (
                  <div className="day-photo">
                    <img
                      src={supabase.storage.from('photos').getPublicUrl(day.cover_photo.file_path).data.publicUrl}
                      alt={day.cover_photo.title || 'Photo du jour'}
                      className="photo-img"
                    />
                  </div>
                )}

                {/* Description/story */}
                {day.description && (
                  <div className="day-story">
                    <p>{day.description}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page {
              size: A4;
              margin: 1.5cm;
            }

            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }

          .print-container {
            background: white;
            color: black;
          }

          .album-title-page {
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            page-break-after: always;
          }

          .album-main-title {
            font-size: 3rem;
            font-weight: bold;
            margin-bottom: 1rem;
            color: #1f2937;
          }

          .album-description {
            font-size: 1.2rem;
            margin-bottom: 2rem;
            color: #6b7280;
            max-width: 600px;
          }

          .album-date {
            font-size: 1.5rem;
            font-weight: 500;
            color: #374151;
          }

          .days-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 2rem;
          }

          .day-entry {
            page-break-inside: avoid;
            margin-bottom: 3rem;
          }

          .day-entry:nth-child(2n) {
            page-break-after: always;
          }

          .day-content {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 1.5rem;
            background: #fafafa;
          }

          .day-header {
            margin-bottom: 1rem;
          }

          .day-title {
            font-size: 1.5rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
            color: #1f2937;
          }

          .day-location {
            font-size: 1rem;
            color: #6b7280;
            font-style: italic;
          }

          .day-photo {
            margin: 1.5rem 0;
            text-align: center;
          }

          .photo-img {
            max-width: 100%;
            max-height: 300px;
            object-fit: cover;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }

          .day-story {
            margin-top: 1rem;
          }

          .day-story p {
            font-size: 1rem;
            line-height: 1.6;
            color: #374151;
            text-align: justify;
          }

          @media screen {
            .print-container {
              max-width: 21cm;
              margin: 0 auto;
              padding: 2rem;
              background: white;
              box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            }
          }

          @media print {
            .print\\:hidden {
              display: none !important;
            }
          }
        `
      }} />
    </>
  );
}