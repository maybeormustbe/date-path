import { useState, useEffect } from 'react';

export interface PrintSettings {
  backgroundColor: string;
  photosPerRow: number;
  orientation: 'portrait' | 'landscape';
}

const DEFAULT_SETTINGS: PrintSettings = {
  backgroundColor: '#ffffff',
  photosPerRow: 3,
  orientation: 'portrait'
};

export function usePrintSettings() {
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const stored = localStorage.getItem('albumPrintSettings');
    if (stored) {
      try {
        const parsedSettings = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsedSettings });
      } catch (error) {
        console.error('Erreur lors du chargement des paramètres:', error);
      }
    }
  }, []);

  const updateSettings = (newSettings: Partial<PrintSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem('albumPrintSettings', JSON.stringify(updated));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem('albumPrintSettings');
  };

  return {
    settings,
    updateSettings,
    resetSettings
  };
}