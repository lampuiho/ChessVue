import { createGameRequestSchema, PlayerType, type ICreateGameRequest, type IEnginePlayer, type IPlayer } from '@/contracts/Game';
import { PlayerColour } from '@/contracts/Chess';
import { TimeControlPreset, type ITimeControl } from '@/contracts/TimeControl';
import type { IEnginePackageUsage, IEngineRecord } from '@/contracts/Engine';
import type { DeepReadonly } from '@/contracts/Readonly';

export const gameClockChoices = [
  { value: TimeControlPreset.Untimed, label: 'Untimed', minutes: 0 },
  { value: TimeControlPreset.Bullet, label: 'Bullet (1+0)', minutes: 1 },
  { value: TimeControlPreset.Blitz, label: 'Blitz (5+0)', minutes: 5 },
  { value: TimeControlPreset.Rapid, label: 'Rapid (10+0)', minutes: 10 },
  { value: TimeControlPreset.Classical, label: 'Classical (30+0)', minutes: 30 },
] as const;
export function selectGameClock(selection: string, current: ITimeControl): ITimeControl {
  if (selection === 'custom') return { initialMs: current.initialMs ?? 600000, incrementMs: current.incrementMs };
  const choice = gameClockChoices.find(clock => clock.value === selection)!;
  return choice.value === TimeControlPreset.Untimed ? { preset: choice.value, incrementMs: 0 }
    : { preset: choice.value, initialMs: choice.minutes * 60000, incrementMs: 0 };
}
export function getGameClockError(clock: DeepReadonly<ITimeControl>) {
  if (clock.preset === TimeControlPreset.Untimed) return clock.initialMs === undefined && clock.incrementMs === 0 ? '' : 'Untimed clocks must have no duration or increment.';
  if (!Number.isInteger(clock.initialMs) || clock.initialMs! < 60000 || clock.initialMs! > 36000000) return 'Enter minutes between 1 and 600.';
  if (!Number.isInteger(clock.incrementMs / 1000) || clock.incrementMs < 0 || clock.incrementMs > 300000) return 'Enter an increment between 0 and 300 seconds.';
  const preset = gameClockChoices.find(choice => choice.value === clock.preset);
  if (preset && (clock.initialMs !== preset.minutes * 60000 || clock.incrementMs !== 0)) return 'Choose Custom to edit the clock duration or increment.';
  return '';
}
export function getGameCreationError(request: DeepReadonly<ICreateGameRequest>) {
  if (!request.name.trim()) return 'Enter a game name.';
  const clockError = getGameClockError(request.timeControl);
  if (clockError) return clockError;
  for (const [player, colour] of [[request.whitePlayer, PlayerColour.White], [request.blackPlayer, PlayerColour.Black]] as const) {
    if (player && player.colour !== colour) return `Choose a ${colour} player for that seat.`;
    if (player?.type === PlayerType.Engine && !(player as DeepReadonly<IEnginePlayer>).assignedEngine.entryPath.trim()) return 'Choose an available engine for each required seat.';
  }
  const analysis = request.analysisEngineProfiles;
  if (analysis.length > 4 || analysis.some(engine => !engine.entryPath.trim())) return 'Choose up to four available analysis engines.';
  if (new Set(analysis.map(engine => engine.displayName)).size !== analysis.length) return 'Analysis engine names must be unique.';
  return '';
}
export function copyGameRequest(request: DeepReadonly<ICreateGameRequest>) {
  const snapshot = createGameRequestSchema.parse(request);
  return { ...snapshot, name: snapshot.name.trim(), allowTakeback: snapshot.allowTakeback ?? true, showLiveAnalysisMoves: snapshot.showLiveAnalysisMoves ?? false };
}
export function createLocalPlayer(colour: PlayerColour): IPlayer {
  return { colour, type: PlayerType.Local, displayName: colour === PlayerColour.White ? 'White' : 'Black' };
}
export function copyEngineProfile(engine: DeepReadonly<IEngineRecord>) {
  return { ...engine, options: { ...engine.options } };
}
export function createEnginePlayer(engine: DeepReadonly<IEngineRecord>, colour: PlayerColour): IEnginePlayer {
  return { colour, type: PlayerType.Engine, displayName: engine.displayName,
    assignedEngine: { displayName: engine.displayName, clientType: engine.clientType, entryPath: engine.entryPath, options: { ...engine.options } } };
}
export function getGameEngineUsage(request: DeepReadonly<ICreateGameRequest>, label: string) {
  const usage: IEnginePackageUsage[] = [];
  for (const player of [request.whitePlayer, request.blackPlayer]) {
    if (player?.type !== PlayerType.Engine) continue;
    const engine = (player as DeepReadonly<IEnginePlayer>).assignedEngine;
    usage.push({ displayName: `${label}: ${player.colour}`, clientType: engine.clientType, entryPath: engine.entryPath });
  }
  for (const engine of request.analysisEngineProfiles) usage.push({ displayName: `${label} analysis: ${engine.displayName}`, clientType: engine.clientType, entryPath: engine.entryPath });
  return usage;
}
