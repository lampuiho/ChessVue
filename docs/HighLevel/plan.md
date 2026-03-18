## Plan: High-Level Architecture for ChessVue

TL;DR - refine application goal, organise existing ideas into a modular frontend architecture that separates UI, state, engine integration and persistence. Provide a blueprint for incremental implementation.

**Steps**
1. **Refine Goal Statement** - clarify primary objectives, scope, and non‑functional requirements such as cross‑platform, data‑driven state, responsiveness, and extensibility.
2. **Survey existing code** (*done during discovery*): note current models, stores, and components to reuse as starting points.
3. **Define core modules**
   - Domain models (IGame, IPlayer, IChessboardState, IAnalysisResult, ISettings, etc. for examples)
   - State management stores (games, settings, analysis, engines)
   - Composables for chess logic and serialization (FEN/PGN, move validation, game validation (checks current board position against move history))
   - Engine adapter interface and concrete implementations (UCI over child process, WebSocket)
   - Platform layer for file I/O and engine processes (NW.js/Electron/Capacitor wrappers)
   - Game state and move representation (including branching logic and mainline tracking)
   - Customizable time control setting model (with presets: Bullet, Blitz, Rapid, Classical + custom for example)
   - Engine communication and analysis results storage
   - Persistence interface with localStorage and filesystem implementations
4. **UI structure**
   - Main layouts: App.vue with top menu, tab bar, router-view
   - Views: GameView (board + player panels + analysis panel), SettingsView, GamesList (tabs), AnalysisView, etc.
   - player panel shows time control (remaining time per player), captured pieces, name and icon/avatar
   - Provide UI panel on right side of GameView showing move history, engine evaluations, move history navigation (such as take back, clicking on move to return board back to history, returning to current position)
   - Styling: responsive with rem units, theme/customization support, mobile aspect ratio to be supported later as well (such as rearranging panels of GameView)
5. **Navigation/Router**
   - Use Vue Router to route between games (each game has unique route), settings, and other global views.
   - Hide tab bar when only one game
6. **Data flow and persistence**
   - All game state, analysis results, settings are serializable JSON
   - Provide save/load APIs using platform-specific storage
   - Implement Pinia plugins or services for auto‑persist
7. **Engine analysis orchestration**
   - Allow multiple engines per game, each with own evaluation score and optional principal variation
   - Store results in analysis store keyed by gameId and engineId
   - Move history shows full notation with navigation (play through moves)
8. **Customization and settings**
   - Piece style, board colors, engine options, UI preferences (rem size etc.) stored in settings store
   - Settings view to adjust and persist
9. **Cross-platform considerations**
   - Abstract engine communication and file dialogs behind interfaces
   - Web builds use WebAssembly engines or remote servers if needed
   - Mobile layouts responsive; consider separate UI for small screens in later phase
10. **Documentation and incremental deliverables**
   - Write interface docs per module (engine adapter interface, store APIs, serial formats)
   - Implement core features first (game state display, move making, single engine analysis stub)
   - Add multi-engine support, persistence, settings, platform integration in subsequent phases

**Relevant files**
- `src/models/interfaces/*` — domain interfaces to extend with analysis and settings types
- `src/stores/Game.ts` — example of games store; to be expanded and factored
- `src/components/Game.vue` — initial game view template
- `src/components/Chessboard.vue` — board component will be central
- `src/router/index.ts` — routing setup already present

**Verification**
1. Create a design document (in docs/high level) summarizing architecture and decisions, then review with user.
2. Ensure new stores and interfaces compile with `npm run type-check`/`vitest`.
3. Manually navigate the app to verify UI layout according to design.
4. Write unit tests for store actions and composables, e.g., serialization round‑trip.
5. Implement a dummy engine adapter returning fixed evaluation; confirm UI displays score.

**Decisions**
- Use Pinia for global state; games list will drive tabs and routes.
- Engines communicate via an abstract interface; actual process management deferred to platform layer.
- All state serializable JSON to enable save/load and platform-agnostic persistence
- Themes and responsive design supported via CSS variables and rem units.
- Move history as branching tree with mainline pointer
- Game move progression in historic board position depends on if take back is allowed, if allowed, create new branch and set as current line, otherwise the new branch is only for analysis and must return to main board position to progress game
- Persistence: Abstract via IPersistenceAdapter interface; implement localStorage initially, filesystem swap-in for desktop platforms

**Further Considerations**
- Move history navigation (play/rewind through moves) — early v1 feature
- Persistence implementation can be swapped at runtime or build time
- save loading games to support public domain formats in the future (deserialiser + mapper to convert to our own json format)