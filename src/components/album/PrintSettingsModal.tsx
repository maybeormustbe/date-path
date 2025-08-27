import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { RotateCcw } from 'lucide-react';
import { PrintSettings, usePrintSettings } from '@/hooks/usePrintSettings';

interface PrintSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrintSettingsModal({ open, onOpenChange }: PrintSettingsModalProps) {
  const { settings, updateSettings, resetSettings } = usePrintSettings();
  const [localSettings, setLocalSettings] = useState<PrintSettings>(settings);

  useEffect(() => {
    if (open) {
      setLocalSettings(settings);
    }
  }, [open, settings]);

  const handleSave = () => {
    updateSettings(localSettings);
    onOpenChange(false);
  };

  const handleReset = () => {
    resetSettings();
    setLocalSettings({
      backgroundColor: '#ffffff',
      photosPerRow: 3,
      orientation: 'portrait'
    });
  };

  const colorPresets = [
    { name: 'Blanc', value: '#ffffff' },
    { name: 'Crème', value: '#fefcf0' },
    { name: 'Gris clair', value: '#f8fafc' },
    { name: 'Beige', value: '#f5f5dc' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Paramètres d'impression</DialogTitle>
          <DialogDescription>
            Configurez l'apparence de votre album imprimé
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Couleur de fond */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Couleur de fond</Label>
            <div className="grid grid-cols-2 gap-2">
              {colorPresets.map((preset) => (
                <button
                  key={preset.value}
                  className={`flex items-center gap-2 p-2 rounded-md border transition-colors hover:bg-muted/50 ${
                    localSettings.backgroundColor === preset.value 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border'
                  }`}
                  onClick={() => setLocalSettings(prev => ({ ...prev, backgroundColor: preset.value }))}
                >
                  <div 
                    className="w-4 h-4 rounded border border-border"
                    style={{ backgroundColor: preset.value }}
                  />
                  <span className="text-sm">{preset.name}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={localSettings.backgroundColor}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, backgroundColor: e.target.value }))}
                className="w-16 h-8 p-1 border-border"
              />
              <Label className="text-sm text-muted-foreground">Couleur personnalisée</Label>
            </div>
          </div>

          <Separator />

          {/* Nombre de photos par ligne */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Photos par ligne</Label>
            <Select 
              value={localSettings.photosPerRow.toString()} 
              onValueChange={(value) => setLocalSettings(prev => ({ ...prev, photosPerRow: parseInt(value) }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 photo par ligne</SelectItem>
                <SelectItem value="2">2 photos par ligne</SelectItem>
                <SelectItem value="3">3 photos par ligne</SelectItem>
                <SelectItem value="4">4 photos par ligne</SelectItem>
                <SelectItem value="5">5 photos par ligne</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Orientation */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Orientation</Label>
            <RadioGroup 
              value={localSettings.orientation} 
              onValueChange={(value: 'portrait' | 'landscape') => setLocalSettings(prev => ({ ...prev, orientation: value }))}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="portrait" id="portrait" />
                <Label htmlFor="portrait" className="text-sm">Portrait</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="landscape" id="landscape" />
                <Label htmlFor="landscape" className="text-sm">Paysage</Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleReset} className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Réinitialiser
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave}>
              Sauvegarder
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}