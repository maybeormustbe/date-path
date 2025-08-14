import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { LatLngExpression, Icon, divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React Leaflet
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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
  center?: LatLngExpression;
  zoom?: number;
  className?: string;
}

// Component to update map view when selected location changes
function MapController({ 
  selectedLocationId, 
  locations 
}: { 
  selectedLocationId?: string; 
  locations: PhotoLocation[] 
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedLocationId) {
      const location = locations.find(loc => loc.id === selectedLocationId);
      if (location) {
        map.setView([location.latitude, location.longitude], 15, {
          animate: true,
          duration: 0.5
        });
      }
    }
  }, [selectedLocationId, locations, map]);

  return null;
}

export function PhotoMap({ 
  locations, 
  selectedLocationId, 
  onLocationClick, 
  center = [46.603354, 1.888334], // Center of France
  zoom = 6,
  className = ""
}: PhotoMapProps) {
  const mapRef = useRef<any>(null);

  // Create custom marker icon for selected location
  const createCustomIcon = (selected: boolean, photoCount: number) => {
    const baseClasses = "flex items-center justify-center text-white font-bold text-xs rounded-full border-2 border-white shadow-lg";
    const bgColor = selected ? "bg-red-500" : "bg-blue-500";
    const size = photoCount > 1 ? "w-8 h-8" : "w-6 h-6";
    
    return divIcon({
      className: 'custom-div-icon',
      html: `<div class="${baseClasses} ${bgColor} ${size}">
        ${photoCount > 1 ? photoCount : ''}
      </div>`,
      iconSize: photoCount > 1 ? [32, 32] : [24, 24],
      iconAnchor: photoCount > 1 ? [16, 32] : [12, 24],
    });
  };

  // Auto-fit bounds when locations change
  useEffect(() => {
    if (mapRef.current && locations.length > 0) {
      const map = mapRef.current;
      const bounds = locations.map(loc => [loc.latitude, loc.longitude] as LatLngExpression);
      
      if (bounds.length === 1) {
        map.setView(bounds[0], 15);
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    }
  }, [locations]);

  if (locations.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full bg-muted/20 ${className}`}>
        <div className="text-center">
          <p className="text-muted-foreground">Aucune photo géolocalisée</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`map-container ${className}`}>
      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full"
        ref={mapRef}
        key={`map-${locations.length}`}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController selectedLocationId={selectedLocationId} locations={locations} />
        
        {locations.map((location) => (
          <Marker
            key={location.id}
            position={[location.latitude, location.longitude]}
            icon={createCustomIcon(location.id === selectedLocationId, location.photoCount)}
            eventHandlers={{
              click: () => onLocationClick?.(location.id),
            }}
          >
            <Popup>
              <div className="text-center">
                <h4 className="font-semibold text-sm mb-1">{location.title}</h4>
                <p className="text-xs text-muted-foreground mb-1">{location.date}</p>
                <p className="text-xs">
                  {location.photoCount} photo{location.photoCount !== 1 ? 's' : ''}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}