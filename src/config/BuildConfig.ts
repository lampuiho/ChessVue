export interface IPersistenceBuildConfig {
  settingsPath: string;
  gameSessionPath: string;
  layoutStatePath: string;
}
export interface IBuildConfig {
  persistence: IPersistenceBuildConfig;
}

export const BuildConfig: IBuildConfig = {
  persistence: {
    settingsPath: 'settings.json',
    gameSessionPath: 'game-session.json',
    layoutStatePath: 'layout-state.json',
  },
};
