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

  // Simple fallback map component using OpenStreetMap
  return (
    <div className={`relative w-full h-full bg-muted/20 ${className}`}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <MapPin className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Carte des photos</h3>
          <p className="text-muted-foreground mb-4">
            {locations.length} emplacement{locations.length !== 1 ? 's' : ''} trouvé{locations.length !== 1 ? 's' : ''}
          </p>
          
          {/* Simple list of locations */}
          <div className="max-w-sm mx-auto space-y-2">
            {locations.slice(0, 5).map((location) => (
              <div 
                key={location.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedLocationId === location.id 
                    ? 'bg-primary/10 border-primary' 
                    : 'bg-card border-border hover:bg-muted/50'
                }`}
                onClick={() => onLocationClick?.(location.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <h4 className="font-medium text-sm">{location.title}</h4>
                    <p className="text-xs text-muted-foreground">{location.date}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-medium">
                      {location.photoCount} photo{location.photoCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            
            {locations.length > 5 && (
              <p className="text-xs text-muted-foreground">
                +{locations.length - 5} autre{locations.length - 5 !== 1 ? 's' : ''} emplacement{locations.length - 5 !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}