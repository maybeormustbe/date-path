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

        // Only initialize map if it doesn't exist
        if (!leafletMapRef.current) {
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

          // Fit bounds if we have multiple locations
          map.whenReady(() => {
            if (locations.length > 1) {
              const bounds = L.latLngBounds(locations.map(loc => [loc.latitude, loc.longitude]));
              map.fitBounds(bounds, { padding: [20, 20] });
            } else if (locations.length === 1) {
              map.setView([locations[0].latitude, locations[0].longitude], 15);
            }
          });
        }

      } catch (error) {
        console.error('Failed to load map:', error);
      }
    };

    loadLeaflet();

    return () => {
      // Don't remove map on unmount, only on component destruction
    };
  }, []); // Empty dependency array - only run once

  // Separate effect for updating markers
  useEffect(() => {
    if (!leafletMapRef.current || locations.length === 0) return;

    const L = window.L || require('leaflet');
    
    // Clear existing markers
    markersRef.current.forEach(marker => {
      leafletMapRef.current?.removeLayer(marker);
    });
    markersRef.current = [];

    // Add new markers
    locations.forEach((location) => {
      const isSelected = location.id === selectedLocationId;
      
      // Create tag-like marker with title
      const markerIcon = L.divIcon({
        className: 'custom-tag-marker',
        html: `<div style="
          background-color: ${isSelected ? '#ef4444' : '#3b82f6'}; 
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          border: 2px solid white;
          position: relative;
          text-align: center;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
        ">
          ${location.title}
          <div style="
            position: absolute;
            bottom: -6px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 6px solid ${isSelected ? '#ef4444' : '#3b82f6'};
          "></div>
        </div>`,
        iconSize: [120, 28],
        iconAnchor: [60, 34], // Adjusted for the pointer
      });

      const marker = L.marker([location.latitude, location.longitude], { icon: markerIcon })
        .addTo(leafletMapRef.current!);

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
  }, [locations, selectedLocationId, onLocationClick]);

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