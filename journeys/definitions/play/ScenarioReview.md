# Play journey scenario review

Reviewed on 15–16 October 2026 against the working-tree scenarios/contracts based on `2d693f7`. This review covers JRN-PLAY-01–12, with execution evidence kept in the generated Playwright report rather than hand-maintained pass flags.

Sources: [scenarios](../../../docs/HighLevel/scenarios.md), [state model](../../../docs/HighLevel/state_model.md), [persistence contract](../../../docs/HighLevel/persistence_contract.md), [engine runtime](../../../docs/HighLevel/engine_runtime.md), `Chessboard.vue`, `GameView.vue`, `GameControlPanel.vue`, `ModalHost.vue`, and the game move/status/player/clock composables. Existing decisions about temporary exploration and actual-move recording remain unchanged. These cases establish play controls and current-position interaction, not historical analysis recording or native engine integration.

Execution: 26 named browser variants under `e2e/journeys/play/`; [implementation record](../../../docs/JourneyImplementation.md) records verification. `npm run journey -- report` joins the exact titles to the latest run; absent variants remain unverified. Timed variants create 5+2 games through Custom and install a fixed browser Date before loading timestamp classes. Seeded game identities, positions, four-tab order and untimed behaviour are preserved.

## JRN-PLAY-01

Intent: SCN-MOVE-01 commits g1-f3 once, rendering board, selected history row, both captured pawns, last-move squares and active Black seat together. Classification: aligned. Autosave confirms one additional live ply. Engine-analysis refresh is covered by Fresh/Analysis, rather than inferred from this empty analysis panel.

## JRN-PLAY-02

Intent: SCN-MOVE-01/02 accepts click and native drag input, rejects wrong-colour/illegal attempts, cancels repeated source selection and replaces own-piece selection. Classification: implementation defect corrected. Browser traces exposed implicit grid rows collapsing empty ranks, making some legal targets invisible. Explicit eight equal rows preserve every target. The timed examples verify unchanged history and no extra increments; one subsequent valid move receives exactly one increment after a controlled second. Move generation checks side-to-move even for dragged pieces. Concurrent stale-position races remain in JRN-RACE.

## JRN-PLAY-03

Intent: BR-MOVE-01-GAME-OVER persists Black's win, rule-resolved reason and detailed-move checkmate state/notation, stops live controls and clocks, and preserves the result through reload and later exploration. Classification: implementation defects corrected. Result calculation previously changed state without stopping the clock; terminal live moves now materialise and stop it, including the terminal node snapshot. Historical exploration after a result no longer asks to rewrite the live game. Both the original mate fixture and a UI-created timed game are exercised. A legal historical analysis branch preserves the original live path/result; an illegal attempt at the mated position adds no move.

## JRN-PLAY-04

Intent: SCN-CTRL-02 cancellation preserves an ongoing game; confirmed resignation records the opposing winner once, stops timing and leaves history review usable. Classification: implementation defect corrected for clock progression. Independent cases cover cancellation and resignation by each colour, including repeated confirmation. The scenario's old Planned label is documentation drift; the confirmation flow is implemented. This case does not claim paused-action coverage.

## JRN-PLAY-05

Intent: SCN-CTRL-03 local/local confirmation supports Cancel, Decline and Accept independently. Resolution cannot be dismissed with Escape, and accepted draw records one draw-agreement result with no offer or live clock. Classification: implementation defect corrected for terminal clock progression; other branches aligned. The scenario's Planned label predates the implemented flow. Repeat-offer throttling and incoming adapter callbacks are outside this case.

## JRN-PLAY-06

Intent: BR-CTRL-03-NON-LOCAL-NO-RESPONSE records an outgoing offer without a local-response dialog or invented engine acceptance. The lit control withdraws it, preserving an ongoing game that can continue with one engine reply. Classification: aligned. Explicit named snapshots establish the pending offer and its removal. UCI draw-response support is not assumed.

## JRN-PLAY-07

Intent: SCN-CTRL-01 restores the prior board, selected history, live path and clock snapshot; the root and a disabled takeback policy expose disabled controls without mutation. Classification: aligned. A timed 5+2 example verifies the removed move's clock increment is also removed and the next root rewind restores both initial balances. Paused takeback ownership remains covered by existing application tests and the Clock backlog.

Player-versus-engine correction: takeback now removes the local player's own last move and the engine's reply, restoring that player's turn and the preceding clock snapshot. Both colours have browser coverage, including Black retaining the engine's opening move and a disabled control before the local player has moved. A held-search case covers cancellation during engine thinking and a subsequent replacement move/reply. Local/local and standalone analysis retain their single-ply rewind.

## JRN-PLAY-08

Intent: SCN-GAME-03 preserves each of four boards/results, falls back after active closure, preserves selection after inactive closure, hides a single tab strip, and closes the last workspace without deleting managed saves. Classification: product gap corrected. Hiding the strip previously removed the only close control; the game menu now exposes Close game independently of tab visibility. The test verifies empty-session reload and unchanged managed-file inventory.

## JRN-PLAY-09

Intent: BR-NAV-02-HAS-GAMES/NO-GAMES replace invalid URLs with the first eligible open game or Home and keep Back/Forward usable. Classification: aligned; the scenario's Planned label and named route guards are documentation drift because GameView validates route-parameter changes. Browser history navigation exercises the existing mounted router, with no store access. No board remains for the empty fallback.

## JRN-PLAY-10

Intent: SCN-ENGINE-03 copies Journey A into Black's seat, commits exactly one reply, and permits return to local play while retaining time control, history, board and another tab's file. Classification: aligned. Both players receive one increment; subsequent White play and reload establish no duplicate reply and a durable local Black assignment. Pending-output cancellation permutations remain in JRN-RACE-03.

Additional engine continuation coverage: import the classic smothered-mate position (White Ka1/Qe6/Nf7; Black Kg8/Rf8/Pg7/Ph7; White to move) through the file picker. The legal line is Nh6+ Kh8 Qg8+ Rxg8 Nf7#. Both Black replies are forced, verified by a focused legality check. Two browser variants assign Journey A to Black (two replies, engine loses) or White (three moves, engine wins), checking each ply, finality, stopped clocks, no later move and persisted result/history after reload. The scripted UCI transport selects this line only at matching puzzle positions; this verifies player orchestration and results, not native-engine playing strength. The puzzle is an import fixture so the existing four-tab workspace is unchanged.

Real Stockfish integration verified on 17 October 2026: two additional variants in [Browser.spec.ts](../../../e2e/Browser.spec.ts) use the normal browser app, configure `stockfish.js` through Settings, import a 1+2 puzzle through the actual file picker and resume play. The engine plays Black to lose or White to win along the same line, with worker creation and successful WASM loading checked. Every history ply and each engine-turn board are asserted; exported documents and reload verify the win, rule-resolved reason, five-ply live path, assigned Stockfish profile and stopped clocks. This exposed an engine-runtime defect: pondering the predicted mating reply started a search from a terminal position, and Stockfish's immediate bestmove was reported as a protocol error. Player turns now skip pondering when the predicted position is terminal, with a focused runtime regression. These real-worker variants supplement the 26 scripted journey variants.

## JRN-PLAY-11

Intent: SCN-ENGINE-03 converts the visible branch to free analysis, retaining the move tree/rendered path while clearing live path, offer, timing and finality. Classification: implementation defect corrected. Unassignment previously retained terminal result/reason and analysis pause ownership, causing converted finished games to keep review controls. It now clears those live-only fields. Independent agreed-draw and resigned fixtures verify finality reset/reload; a timed branch with an unresolved outgoing offer verifies branch preservation and further exploration. Ordinary post-result review without unassignment still preserves the result under JRN-PLAY-03/04.

## JRN-PLAY-12

Intent: BR-ENGINE-03-SAME-SELECTION preserves the copied engine on Cancel or Keep; BR-ENGINE-03-ENGINE-UNAVAILABLE retains the failed assignment with scoped unavailable feedback and allows reassignment/recovery without history loss. Classification: implementation defects corrected. Raw engine-runtime failure changes previously left the player strip displaying Starting; player creation, reassignment and restore now prepare a shallow reactive engine runtime in state, and the panel tracks its status and preserved typed platform error directly. A delayed retry uses the ordinary due-turn gate, preventing it from replacing a local turn after recovery. Tests use the normal player dialog and actual scripted transport failure, then advance retry timers and make a legal local reply. Existing application regression UI-04 separately preserves assigned options across inventory edits/removal. Full retry lifecycle and stale-output permutations remain in JRN-RACE.
