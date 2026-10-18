export interface IPersistenceBuildConfig {
  settingsPath: string;
  gameSessionPath: string;
  layoutStatePath: string;
}
export interface IBuildConfig {
  persistence: IPersistenceBuildConfig;
  engine: { untimedMoveTimeMs: number };
}

export const BuildConfig: IBuildConfig = {
  engine: { untimedMoveTimeMs: 1000 },
  persistence: {
    settingsPath: 'settings.json',
    gameSessionPath: 'game-session.json',
    layoutStatePath: 'layout-state.json',
  },
};
