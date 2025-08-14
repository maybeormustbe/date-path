import React, { useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';

interface PhotoLocation {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  date: string;
  photoCount: number;
  selected?: boolean;
}

interface PhotoMapProps {
  locations: PhotoLocation[];
  selectedLocationId?: string;
  onLocationClick?: (locationId: string) => void;
  center?: [number, number];
  zoom?: number;
  className?: string;
}

export function PhotoMap({ 
  locations, 
  selectedLocationId, 
  onLocationClick, 
  className = ""
}: PhotoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined') return;

    // Dynamically import leaflet to avoid SSR issues
    import('leaflet').then((L) => {
      // Clear existing map
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
      }

      // Calculate center point from locations
      let center: [number, number] = [46.603354, 1.888334]; // Default to France
      if (locations.length > 0) {
        const avgLat = locations.reduce((sum, loc) => sum + loc.latitude, 0) / locations.length;
        const avgLng = locations.reduce((sum, loc) => sum + loc.longitude, 0) / locations.length;
        center = [avgLat, avgLng];
      }

      // Create map
      const map = L.map(mapRef.current).setView(center, locations.length > 0 ? 10 : 6);

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      // Wait for map to be ready before adding markers and fitting bounds
      map.whenReady(() => {
        // Add markers
        const markers: any[] = [];
        
        locations.forEach((location) => {
          const isSelected = location.id === selectedLocationId;
          
          // Create custom marker
          const markerIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="
              width: ${location.photoCount > 1 ? '32px' : '24px'}; 
              height: ${location.photoCount > 1 ? '32px' : '24px'}; 
              background-color: ${isSelected ? '#ef4444' : '#3b82f6'}; 
              border: 2px solid white; 
              border-radius: 50%; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              color: white; 
              font-weight: bold; 
              font-size: 12px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            ">
              ${location.photoCount > 1 ? location.photoCount : ''}
            </div>`,
            iconSize: location.photoCount > 1 ? [32, 32] : [24, 24],
            iconAnchor: location.photoCount > 1 ? [16, 32] : [12, 24],
          });

          const marker = L.marker([location.latitude, location.longitude], { icon: markerIcon })
            .addTo(map);

          markers.push(marker);

          // Add popup
          marker.bindPopup(`
            <div style="text-align: center;">
              <h4 style="font-weight: 600; margin-bottom: 4px;">${location.title}</h4>
              <p style="color: #666; font-size: 12px; margin-bottom: 4px;">${location.date}</p>
              <p style="font-size: 12px;">${location.photoCount} photo${location.photoCount !== 1 ? 's' : ''}</p>
            </div>
          `);

          // Add click handler
          marker.on('click', () => {
            onLocationClick?.(location.id);
          });
        });

        // Fit bounds if we have locations - wait a bit to ensure everything is ready
        if (locations.length > 0 && markers.length > 0) {
          setTimeout(() => {
            try {
              const group = L.featureGroup(markers);
              if (group.getBounds().isValid()) {
                map.fitBounds(group.getBounds().pad(0.1));
              }
            } catch (error) {
              console.warn('Could not fit bounds:', error);
            }
          }, 100);
        }

        // Focus on selected location
        if (selectedLocationId) {
          const selectedLocation = locations.find(loc => loc.id === selectedLocationId);
          if (selectedLocation) {
            setTimeout(() => {
              try {
                map.setView([selectedLocation.latitude, selectedLocation.longitude], 15);
              } catch (error) {
                console.warn('Could not set view:', error);
              }
            }, 200);
          }
        }
      });

      leafletMapRef.current = map;
    }).catch((error) => {
      console.error('Failed to load Leaflet:', error);
    });

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [locations, selectedLocationId, onLocationClick]);

  if (locations.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full bg-muted/20 ${className}`}>
        <div className="text-center">
          <MapPin className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucune photo géolocalisée</h3>
          <p className="text-muted-foreground">
            Ajoutez des photos avec des données de localisation pour voir la carte
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`map-container ${className}`}>
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-lg"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
}