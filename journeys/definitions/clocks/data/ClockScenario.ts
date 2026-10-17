export const clockMenus = ['Settings', 'Save', 'Load', 'Custom'] as const;
export type ClockMenu = typeof clockMenus[number];
export const pauseOwners = ['manual', 'analysis', 'restored manual'] as const;
