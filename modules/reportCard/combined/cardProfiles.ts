import type { Priority } from './engine.js';

export const familyAreas: Priority[] = ['family', 'credit', 'lifestyle', 'protection', 'retirement', 'tax'];
export const businessAreas: Priority[] = ['business', 'benefits', 'commercial', 'tax'];

export function mainReportCard(selected: readonly Priority[]): 'family' | 'business' | undefined {
  if (selected.length === familyAreas.length && familyAreas.every(area => selected.includes(area))) return 'family';
  if (selected.length === businessAreas.length && businessAreas.every(area => selected.includes(area))) return 'business';
}
