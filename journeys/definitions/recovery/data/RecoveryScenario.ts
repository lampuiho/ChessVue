export const faultVariants = ['settings', 'layout', 'missing-game', 'unsupported-game'] as const;
export const restoredRoutes = [
  { name: 'game', route: '/game/recovery-valid' },
  { name: 'settings', route: '/settings/appearance' },
  { name: 'library', route: '/saved-games/load' },
  { name: 'library-selection', route: '/saved-games/load/recovery-second' },
  { name: 'save', route: '/saved-games/save/recovery-valid' },
] as const;
export const fallbackScenarios = [
  { name: 'no-valid-games', route: '/home', ids: [], warning: true },
  { name: 'stale-active', route: '/game/recovery-valid', ids: ['recovery-valid'], warning: true },
  { name: 'unknown-game-route', route: '/game/recovery-second', ids: ['recovery-second', 'recovery-valid'], warning: false },
  { name: 'invalid-route', route: '/home', ids: [], warning: true },
  { name: 'nonmember-active', route: '/home', ids: [], warning: true },
  { name: 'ui-only', route: '/home', ids: [], warning: false },
  { name: 'duplicate-tabs', route: '/game/recovery-valid', ids: ['recovery-second', 'recovery-valid'], warning: false },
] as const;
export const runtimeVariants = ['unavailable-player', 'unavailable-analysis', 'paused', 'board-edit', 'live-engine'] as const;
