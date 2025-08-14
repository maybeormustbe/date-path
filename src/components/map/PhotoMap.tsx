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
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!mapRef.current) return;

    // Add Leaflet CSS if not already present
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Load Leaflet dynamically
    const loadLeaflet = async () => {
      try {
        // Import Leaflet
        const L = await import('leaflet');
        
        // Fix marker icons
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        });

        // Clear existing map
        if (leafletMapRef.current) {
          leafletMapRef.current.remove();
        }
        
        // Clear existing markers
        markersRef.current = [];

        // Calculate center
        let center: [number, number] = [46.603354, 1.888334];
        if (locations.length > 0) {
          const avgLat = locations.reduce((sum, loc) => sum + loc.latitude, 0) / locations.length;
          const avgLng = locations.reduce((sum, loc) => sum + loc.longitude, 0) / locations.length;
          center = [avgLat, avgLng];
        }

        // Create map
        const map = L.map(mapRef.current, {
          center,
          zoom: locations.length > 0 ? 10 : 6,
          zoomControl: true,
          attributionControl: true
        });

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 18
        }).addTo(map);

        leafletMapRef.current = map;

        // Wait for map to load
        map.whenReady(() => {
          // Add markers after map is ready
          locations.forEach((location) => {
            const isSelected = location.id === selectedLocationId;
            
            // Simple colored marker
            const marker = L.circleMarker([location.latitude, location.longitude], {
              radius: location.photoCount > 1 ? 12 : 8,
              fillColor: isSelected ? '#ef4444' : '#3b82f6',
              color: '#ffffff',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8
            }).addTo(map);

            // Add number if multiple photos
            if (location.photoCount > 1) {
              const numberMarker = L.marker([location.latitude, location.longitude], {
                icon: L.divIcon({
                  className: 'photo-count-marker',
                  html: `<div style="
                    color: white; 
                    font-weight: bold; 
                    font-size: 11px; 
                    text-align: center; 
                    line-height: 20px;
                    pointer-events: none;
                  ">${location.photoCount}</div>`,
                  iconSize: [20, 20],
                  iconAnchor: [10, 10]
                })
              }).addTo(map);
              markersRef.current.push(numberMarker);
            }

            markersRef.current.push(marker);

            // Add popup
            marker.bindPopup(`
              <div style="text-align: center; padding: 5px;">
                <h4 style="margin: 0 0 5px 0; font-weight: 600;">${location.title}</h4>
                <p style="margin: 0 0 3px 0; color: #666; font-size: 12px;">${location.date}</p>
                <p style="margin: 0; font-size: 12px;">${location.photoCount} photo${location.photoCount !== 1 ? 's' : ''}</p>
              </div>
            `);

            // Click handler
            marker.on('click', () => {
              onLocationClick?.(location.id);
            });
          });

          // Fit bounds if we have multiple locations
          if (locations.length > 1) {
            const bounds = L.latLngBounds(locations.map(loc => [loc.latitude, loc.longitude]));
            map.fitBounds(bounds, { padding: [20, 20] });
          } else if (locations.length === 1) {
            map.setView([locations[0].latitude, locations[0].longitude], 15);
          }
        });

      } catch (error) {
        console.error('Failed to load map:', error);
      }
    };

    loadLeaflet();

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
      markersRef.current = [];
    };
  }, [locations]);

  // Handle selected location change
  useEffect(() => {
    if (!leafletMapRef.current || !selectedLocationId) return;

    const selectedLocation = locations.find(loc => loc.id === selectedLocationId);
    if (selectedLocation) {
      leafletMapRef.current.setView([selectedLocation.latitude, selectedLocation.longitude], 15);
    }
  }, [selectedLocationId, locations]);

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
    <div className={`${className}`}>
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-lg border"
        style={{ 
          minHeight: '400px',
          height: '100%',
          background: '#f0f0f0'
        }}
      />
    </div>
  );
}