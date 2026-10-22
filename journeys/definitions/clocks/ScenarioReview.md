# Clock scenario review

Reviewed on 17 October 2026 against the scenarios, clock/state contracts and application. The owned seed preserves all three original game IDs, moves, players, takeback permissions and paused 120-second/+2-second and three-second controls. Browser time is installed before bootstrap, including the Date subclasses used by persisted timestamps. Execution evidence belongs to generated Playwright reports; case metadata carries no pass flags.

The [Clocks verification record](../../../docs/JourneyImplementation.md#clocks-verification) links the full unit/browser run and exact title audit for all twelve groups.

Explicit Analyse retains its independent pause owner; ordinary review and game-tab selection keep existing live timing. This preserves the documented progression matrix in [Q-PLAY-001](../../../docs/questions/play/Q-PLAY-001-LiveProgressDuringAnalysis.md). Engine-finish-during-pause permutations remain in JRN-RACE. No new delay, background opponent scheduling or timeout-material adjudication policy is introduced.

## JRN-CLOCK-01

Intent: SCN-TIME-01/03 charges one elapsed second and one increment at actual move commit. Classification: restore defect corrected. A paused restored game resumed its clock without creating a player-turn request, so Nf3 was rejected. Resume now starts an eligible missing turn after deferred work is flushed; an existing request is retained. Browser assertions verify 121 seconds for White, Black running, one added live ply and no further White increment after another second. Integration counts the retained turn promise across repeated Resume.

## JRN-CLOCK-02

Intent: SCN-TIME-02 freezes either active colour and guards all gameplay mutations. Classification: aligned. Both-colour browser variants assert frozen display, disabled board/history, absent takeback/resign/draw controls, exact canonical tree/clock preservation and subsequent legal play. Integration directly rejects move, history, takeback, resign and all exposed draw mutations without changing serialised game data. Running engine management remains separately covered by Analysis.

## JRN-CLOCK-03

Intent: SCN-TIME-05 and SCN-NAV-01 pair each menu pause with its return. Classification: aligned. Settings, Save, Load and Custom each reset independently, freeze 30 seconds of wall time, resume only on return, then charge one more second and commit Nf3 with the exact expected increment. All four variants join the smoke set.

## JRN-CLOCK-04

Intent: BR-TIME-05-ALREADY-PAUSED removes only Menu ownership. Classification: restore defect corrected. Runtime owners were omitted from saves, allowing a menu return to resume an already paused restored game. Hydration now reconstructs Manual ownership for persisted paused live states. Twelve browser variants cover all four menus with manual, analysis-only and restored-manual pauses. Analysis exploration keeps the live path fixed and the clock stopped until Exit analysis. Integration also deduplicates repeated owners and preserves Manual plus Analysis when Menu is removed twice.

## JRN-CLOCK-05

Intent: disabled policy and untimed controls retain their documented behaviour. Classification: aligned. Eight independent variants use the real Settings control or Custom untimed creation, visit every menu, advance wall time and return. Disabled auto-pause consumes exactly five seconds; untimed games never expose timed pause/resume and accept a live move with omitted remaining time.

## JRN-CLOCK-06

Intent: SCN-TIME-04 finalises the live turn at the authoritative zero boundary. Classification: interruption race corrected. Pausing at expiry could leave a finished turn in a paused ongoing state; pause/resume boundaries now reconcile expiry before changing ownership. Both colours are ongoing at 2,999 ms, expire at 3,000 ms and clamp at zero. Dismissal, delayed ticks and later analysis moves preserve the actual line and result; finished review remains available. Integration submits a move exactly at expiry and proves no move or increment is committed, then attempts Resume directly. A sub-100-ms display may round to zero before authoritative expiry; result assertions distinguish those states.

## JRN-CLOCK-07

Intent: another game receives its own timeout without remounting GameView. Classification: aligned. A DOM instance marker proves the retained view; A loses on White's time and B loses on Black's time. Both saved results are checked independently. The original UI-06 consecutive-tabs integration is retained under Clocks. This variant joins the smoke set.

## JRN-CLOCK-08

Intent: takeback reopens a live game and allows a fresh timeout notification. Classification: notification ownership defect corrected. A view-local flag allowed the same timeout to appear again after visiting Save. Notification state now belongs to the game's transient runtime and is reset for each actual timeout. The browser expires Black, takes back to the paused root snapshot, expires White, saves and returns without another notification. The original UI-06 reopening integration is retained here.

## JRN-CLOCK-09

Intent: timestamp arithmetic survives missed UI ticks and repeated focus signals. Classification: duplicate finalisation defect corrected. Concurrent sync calls previously each awaited turn cleanup before marking the result, allowing both to finalise. They now share one pending settlement, cancelling the old turn before finalisation and ignoring a replaced clock snapshot. Browser variants simulate hidden/visible DOM events and advance wall time without delivering missed intervals, then verify five seconds elapsed or one expired result. Integration asserts exactly one workspace invalidation and one modal across simultaneous sync calls, focus events and a route remount. This controls throttling deterministically; it does not claim OS-level suspension verification.

## JRN-CLOCK-10

Intent: running restores charge elapsed wall time; paused restores retain saved remaining time. Classification: ownership reconstruction implemented. Running, paused, expired and analysis-paused saves reload through normal session restoration, retaining named snapshot bytes and permitting continued play where eligible. Since version-1 saves exclude runtime pause reasons, restored paused analysis reconstructs Manual only: explicit Resume starts actual play while analysis stays selected, and Exit never releases a genuine pause. This preserves a saved genuine pause without requiring an extra Exit or changing the schema. Browser and integration assertions cover this explicit return sequence and menu cancellation before Resume.

## JRN-CLOCK-11

Intent: selecting another game tab preserves existing timing independently of menu policy. Classification: aligned. A retained view switches to paused B while White in the first game consumes five seconds, returns without menu pause, commits one increment and verifies B stayed at three seconds.

## JRN-CLOCK-12

Intent: repeated owners, zero/nonzero increment and delayed reconciliation compose without duplicate work. Classification: the defects above are corrected. Two browser variants run three pause/resume cycles, ignore hidden paused time and commit exactly one move/increment. Focused integration covers duplicate owner removal, exact expiry, concurrent sync finalisation, resumed request identity, fixed post-timeout results and restored ownership. No browser-only fault hook or game-state mutation bypass is added.
