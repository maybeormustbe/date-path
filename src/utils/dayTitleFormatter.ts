/**
 * Utilitaire pour calculer dynamiquement les titres des journées
 * selon la formule: "J{numéro}, {jour} {date} {mois}, {lieu}"
 */

const frenchDays = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const frenchMonths = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                     'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export interface DayForTitle {
  date: string;
  cover_photo?: {
    location_name?: string | null;
  } | null;
}

/**
 * Calcule le titre d'une journée selon la formule demandée
 * @param day - Les données de la journée
 * @param dayNumber - Le numéro de la journée dans l'album (1, 2, 3, etc.)
 * @returns Le titre formaté
 */
export function calculateDayTitle(day: DayForTitle, dayNumber: number): string {
  const date = new Date(day.date + 'T00:00:00');
  
  const weekDay = frenchDays[date.getDay()];
  const dayOfMonth = date.getDate();
  const month = frenchMonths[date.getMonth()];
  
  // Utiliser le lieu de la photo de couverture ou ne pas en afficher
  const locationName = day.cover_photo?.location_name || '';
  
  // Format: "J1, lundi 12 juillet, La Hautière"
  const title = `J${dayNumber}, ${weekDay} ${dayOfMonth} ${month}${locationName ? `, ${locationName}` : ''}`;
  
  return title;
}

/**
 * Calcule les titres pour une liste de journées triées par date
 * @param days - Liste des journées triées par date
 * @returns Liste des journées avec leurs titres calculés
 */
export function calculateDayTitles<T extends DayForTitle>(days: T[]): (T & { calculatedTitle: string })[] {
  return days.map((day, index) => ({
    ...day,
    calculatedTitle: calculateDayTitle(day, index + 1)
  }));
}