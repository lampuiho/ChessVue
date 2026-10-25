import { test, expect } from './SetupTest';
import type { Locator, Page } from '@playwright/test';
import type { IGame } from '../../../src/contracts';
import { openJourney } from '../../support/JourneyBootstrap';
import { playMove, square } from '../../support/BoardInteraction';
import { setCustomClock } from '../../support/GameCreation';
import { saveCurrentGame } from '../../support/GameSave';
import { managedFiles, readSession } from '../../support/SaveInspection';
import { finishEditing, openSetupStart, selectSetupBoard } from './SetupAction';

async function _configureStart(dialog: Locator, source: string) {
  await setCustomClock(dialog, '9', '2');
  await dialog.getByLabel('Name', { exact: false }).fill('Started study');
  await dialog.getByLabel(source === 'edited' ? 'Black' : 'White', { exact: true }).selectOption({ label: 'Use profile: Journey B' });
  if (source === 'edited') {
    await dialog.getByText('Allow takebacks', { exact: true }).click();
    await dialog.getByText('Show live analysis moves', { exact: true }).click();
  }
  await expect(dialog.getByRole('checkbox', { name: /Allow takebacks/ })).toBeChecked({ checked: source === 'history' });
  await expect(dialog.getByRole('checkbox', { name: /Show live analysis moves/ })).toBeChecked({ checked: source === 'edited' });
}
function _expectStartedPosition(started: IGame, before: IGame, source: string) {
  expect(started.rootPosition).toEqual(before.rootPosition);
  expect(started.moveTree).toEqual(before.moveTree);
  expect(started.livePath).toEqual(before.renderedPath);
  expect(started.metadata.id).toBe(before.metadata.id);
  expect(started.metadata.name).toBe('Started study');
  expect(started.timeControl).toEqual({ initialMs: 540000, incrementMs: 2000 });
  expect(started.gameplayOptions).toEqual({ allowTakeback: source === 'history', showLiveAnalysisMoves: source === 'edited' });
  expect(started.whitePlayer?.type).toBe(source === 'edited' ? 'local' : 'engine');
  expect(started.blackPlayer?.type).toBe(source === 'edited' ? 'engine' : 'local');
  expect(started.clockSnapshot.white.remainingMs).toBe(540000);
  expect(started.clockSnapshot.black.remainingMs).toBe(540000);
}
async function _cancelChangedStart(page: Page, before: IGame) {
  const files = await managedFiles(page);
  const dialog = await openSetupStart(page);
  await setCustomClock(dialog, '9', '2');
  await dialog.getByLabel('Name', { exact: false }).fill('Cancelled name');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await managedFiles(page)).toEqual(files);
  const cancelled = await saveCurrentGame(page, 'cancelled');
  expect({ ...cancelled, metadata: before.metadata }).toEqual(before);
}
for (const source of ['edited', 'history']) {
  test(`JRN-SETUP-07 @smoke cancels then starts the ${source} position with custom players, clock and policies`, async ({ page }) => {
    await openJourney(page, 'setup');
    if (source === 'edited') {
      await selectSetupBoard(page);
      await square(page, 'd5').locator('.chess-piece').dragTo(square(page, 'd6'));
      await finishEditing(page);
    }
    const before = await saveCurrentGame(page, 'prepared');
    await _cancelChangedStart(page, before);
    const dialog = await openSetupStart(page);
    await _configureStart(dialog, source);
    await dialog.getByRole('button', { name: 'Start game', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.turn-indicator')).toHaveText('Live');
    await expect(page.locator('.player-clock--running')).toContainText('9:00');
    const started = await saveCurrentGame(page, 'started');
    _expectStartedPosition(started, before, source);
    await expect(page.getByRole('button', { name: /Edit board|Finish editing/ })).toHaveCount(0);
    await playMove(page, source === 'edited' ? 'd6' : 'e7', source === 'edited' ? 'd7' : 'e6');
    await expect(page.locator('.history-row')).toHaveCount(source === 'edited' ? 2 : 5);
    const played = await saveCurrentGame(page, 'played');
    expect(played.livePath).toHaveLength(before.renderedPath.length + 2);
    expect(played.clockSnapshot.white.remainingMs).toBe(542000);
    expect(played.clockSnapshot.black.remainingMs).toBe(542000);
    expect((await readSession(page)).openGameIds).toEqual(['setup-analysis', 'setup-board']);
  });
}
