import { test, expect } from './SessionTest';
import type { Page } from '@playwright/test';
import type { IGame } from '../../src/contracts';
import { studyExportPath, studyOpening } from '../../journeys/definitions/sessions/data/SessionScenario';
import { openCustomGame, createWorkspace, setCustomClock } from '../support/GameCreation';
import { playMove, square } from '../support/BoardInteraction';
import { saveCurrentGame } from '../support/GameSave';
import { readFile, readSession } from '../support/SaveInspection';
import { expectCanonical, nodeAt } from '../journeys/saves/SaveAction';
import { expectOutput } from '../journeys/analysis/AnalysisAction';
import { expectFreeWorkspace, finishEditing, historyRow, openSetupStart } from '../journeys/setup/SetupAction';
import { latestSearch, release } from '../journeys/engine-races/RaceAction';
import { exportSession, importSession, openSession, playSessionMoves, reloadSession } from './SessionAction';
async function _createNestedStudy(page: Page) {
  const dialog = await openCustomGame(page);
  await dialog.getByLabel('Name', { exact: false }).fill('Nested session study');
  await dialog.getByRole('button', { name: 'Free analysis', exact: true }).click();
  await dialog.getByLabel('Add analysis engine', { exact: true }).selectOption({ label: 'Journey A' });
  await dialog.getByRole('button', { name: 'Add engine', exact: true }).click();
  await createWorkspace(page);
  await expectOutput(page, ['Journey A']);
  await playSessionMoves(page, studyOpening, ['Journey A']);
  await historyRow(page, 'e4').click();
  await playSessionMoves(page, [['c7', 'c5'], ['g1', 'f3']], ['Journey A']);
  await historyRow(page, 'c5').click();
  await playMove(page, 'b1', 'c3');
  await expectOutput(page, ['Journey A']);
  const study = await saveCurrentGame(page, 'Nested alternatives');
  expectFreeWorkspace(study);
  expect(study.renderedPath).toEqual([0, 1, 1]);
  expect(nodeAt(study, [0]).children).toHaveLength(2);
  expect(nodeAt(study, [0, 1]).children).toHaveLength(2);
  expect(JSON.stringify(study.moveTree)).not.toContain('recordedAnalysis');
  return study;
}
async function _editVisibleStudy(page: Page, study: IGame) {
  await page.getByRole('button', { name: /Edit board/ }).click();
  await square(page, 'a3').click({ button: 'right' });
  await finishEditing(page);
  const unchanged = await saveCurrentGame(page, 'Unchanged editing');
  expect(unchanged.moveTree).toEqual(study.moveTree);
  expect(unchanged.renderedPath).toEqual(study.renderedPath);
  expect(unchanged.rootPosition).toEqual(study.rootPosition);
  await page.getByRole('button', { name: /Edit board/ }).click();
  await expect(page.locator('.history-row')).toHaveCount(6);
  await square(page, 'a2').locator('.chess-piece').dragTo(square(page, 'a3'));
  await expect(page.locator('.history-row')).toHaveCount(0);
  await finishEditing(page);
  await expectOutput(page, ['Journey A']);
  const edited = await saveCurrentGame(page, 'Prepared position');
  expectFreeWorkspace(edited);
  expect(edited.moveTree.root.children).toEqual([]);
  expect(edited.renderedPath).toEqual([]);
  expect(edited.rootPosition.sideToMove).toBe('black');
  for (const [id, kind, colour] of [[16, 'pawn', 'white'], [18, 'knight', 'white'], [34, 'pawn', 'black'], [28, 'pawn', 'white']] as const) {
    expect(edited.rootPosition.board[id]).toEqual({ kind, colour });
  }
  expect(edited.rootPosition.board[8]).toBeNull();
  return edited;
}
async function _startPreparedGame(page: Page, edited: IGame) {
  await page.evaluate(() => window.chessVueJourney.engines.hold('player'));
  const dialog = await openSetupStart(page);
  await setCustomClock(dialog, '3', '2');
  await dialog.getByLabel('Name', { exact: false }).fill('Started session study');
  await dialog.getByLabel('Black', { exact: true }).selectOption({ label: 'Use profile: Journey B' });
  await expect(dialog.getByRole('checkbox', { name: /Show live analysis moves/ })).toBeChecked();
  await dialog.getByRole('button', { name: 'Start game', exact: true }).click();
  const search = await latestSearch(page, 'player', 'journey://b');
  await expect(page.locator('.player-clock--running')).toHaveText('3:00');
  await release(page, search.id);
  await expect(page.locator('.history-row')).toHaveCount(1);
  await expectOutput(page, ['Journey A']);
  const started = await saveCurrentGame(page, 'Engine replied');
  expect(started.metadata.id).toBe(edited.metadata.id);
  expect(started.rootPosition).toEqual(edited.rootPosition);
  expect(started.livePath).toEqual([0]);
  expect(started.blackPlayer).toMatchObject({ type: 'engine', assignedEngine: { displayName: 'Journey B' } });
  expect(started.timeControl).toEqual({ initialMs: 180000, incrementMs: 2000 });
  expect(started.clockSnapshot.black.remainingMs).toBe(182000);
  return started;
}
async function _transferStudy(page: Page, started: IGame) {
  const exported = await exportSession(page, studyExportPath);
  expectCanonical(exported, started);
  const sourcePath = `saves/${started.metadata.id}/Engine replied.json`;
  const bytes = await readFile(page, sourcePath);
  const id = await importSession(page, studyExportPath);
  expect(id).not.toBe(started.metadata.id);
  await expectOutput(page, ['Journey A']);
  const imported = await saveCurrentGame(page, 'Imported study');
  expectCanonical(imported, exported);
  expect((await readSession(page)).openGameIds).toEqual([started.metadata.id, id]);
  expect(await readFile(page, sourcePath)).toBe(bytes);
  await reloadSession(page);
  await expect(page).toHaveURL(new RegExp('/game/' + id + '$'));
  await expectOutput(page, ['Journey A']);
  expectCanonical(await saveCurrentGame(page, 'Restored study'), imported);
}
test('JRN-SESSION-02 branches, edits the visible study, starts an engine game and transfers it', async ({ page }) => {
  await openSession(page);
  const study = await test.step('Create free analysis and nested alternatives', () => _createNestedStudy(page));
  const edited = await test.step('Preserve history until the first effective edit of the selected position', () => _editVisibleStudy(page, study));
  const started = await test.step('Start a timed game on the prepared board and receive one engine reply', () => _startPreparedGame(page, edited));
  await test.step('Export, import with fresh identity and reload', () => _transferStudy(page, started));
});
