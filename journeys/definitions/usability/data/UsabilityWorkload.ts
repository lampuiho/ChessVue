import { createGame } from '../../../builders/GameFixtureBuilder';
import { appendMoves } from '../../../builders/HistoryFixtureBuilder';
import { saveFile } from '../../../builders/SaveFixtureBuilder';
import { createWorkspace } from '../../../builders/WorkspaceFixtureBuilder';
import { fixtureTimestamp } from '../../../data/FixtureTimestamp';
import { usabilityWorkload, usabilityGameName, usabilitySaveName } from './UsabilityScenario';
export function createUsabilityWorkspace() {
  const moves = Array.from({ length: usabilityWorkload.plies / 4 }, () => ['g1f3', 'g8f6', 'f3g1', 'f6g8']).flat();
  const game = createGame('usability-study', usabilityGameName, moves);
  appendMoves(game, [0], ['d7d5', 'd2d4', 'g8f6']);
  appendMoves(game, [0, 1], ['c2c4', 'e7e6', 'b1c3']);
  appendMoves(game, [0, 1, 1], ['c7c6', 'd2d4']);
  const files = Array.from({ length: usabilityWorkload.snapshots }, (_, index) => {
    const snapshot = createGame(game.metadata.id, usabilityGameName, moves.slice(0, (index + 1) * usabilityWorkload.snapshotStepPlies));
    return saveFile(snapshot, index === 0 ? usabilitySaveName : `Study snapshot ${String(index).padStart(2, '0')}`, Date.parse(fixtureTimestamp) + index * 1000);
  });
  return createWorkspace([game], { files: [...files, saveFile(game, 'auto', Date.parse(fixtureTimestamp) + (usabilityWorkload.snapshots + 1) * 1000)] });
}
