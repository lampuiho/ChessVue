**Architecture Overview for ChessVue**

This high level architecture shows what is required in the app to achieve goal set out in the [plan](plan.md).

Here the information is brief and does not contain every single feature of the modules or even every single modules.

It merely serves as a reference for what layers are need to be designed and implemented

The system follows a **layered architecture** with **four tiers** and **strictly acyclic dependencies**
each module in each layer must be completely independent of each other:

---

**LAYER 1: Platform Abstraction (Bottom)**
- Interfaces for file I/O, process management, environment detection
- Implementations per platform (Browser/localStorage, NW.js/filesystem, Capacitor/native)
- No dependencies on layers above

**LAYER 2: Domain Logic**
- Game rule (move validation, board state, piece logic)
- Time control engine (countdown, increment logic, variant support)
- Move tree and branching logic
- Serialization/deserialization (FEN, PGN, JSON)
- *No UI dependencies; pure game logic*

**LAYER 3: State Management (Pinia Stores)**
- Games store (manage game instances, CRUD)
- Settings store (persisted user preferences)
- Analysis store (engine results, keyed by gameId + engineId)
- Engines store (available engines, their configs)
- UI state store (routing, modal states)
- *Depends on: Domain Logic, Platform Abstraction*

**LAYER 4: Presentation (Vue Components + Router)**
- Views (GameView, SettingsView, etc.)
- Components (Chessboard, PlayerPanel, HistoryPanel, MenuBar, TabBar)
- Router setup (game routes, settings route)
- *Depends on: State Management, Domain Logic*

---

**MODULE SUMMARIES:**

**Domain Logic Modules:**
1. **Game Rules** — validates moves, updates board state (and analysis mode for making moves without progressing game), detects game end (checkmate, stalemate). Exposes: valid move checking, board/piece state, game status.
2. **Move Update** — tree structure for branching move history (and the time the move is made since game start). Exposes: add move as main branch (for navigate to old move as take back and continuing game from there), add move without changing branch (as analysis mid game when take back is not allowed), navigate to last node, navigate to node, query mainline path, prune moves (for deleting future moves made in analysis mode and making real move).
3. **Time Control** — manages per-player time, applies increments/delays per variant. Exposes: tick (update game time, time is stored as relative time, on game load a reference time is created to continue calculation with current time), apply increment, query remaining time, variant configuration.
4. **Serialization** — convert game state ↔ FEN/PGN/JSON. Exposes: serialize game, deserialize from format, migrate old formats.

**State Management Modules:**
1. **Games Store** — list of active games, CRUD operations. Exposes: create game, load game, get game by ID, delete game, update game.
7. **Settings Store** — user preferences (piece style, board color, time presets, engine options, UI scale). Exposes: get/set setting, apply theme, reset to defaults, persist settings.
8. **Analysis Store** — engine evaluations per position. Exposes: store evaluation, query by gameId + engineId + position, clear outdated results.
9. **Engines Store** — available UCI engines, their paths and options. Exposes: list engines, add engine, configure engine, remove engine.
10. **UI State Store** — routing state, modal visibility, selected game/engine. Exposes: set current game, set modal state, toggle panel visibility.

**Platform Abstraction Modules:**
1. **File I/O Adapter** — abstract interface for save/load. Exposes: load game from file, save game to file, list recent games.
2. **Process Manager** — abstract interface for communication with executable processed on the OS platform (or browser), in particularly the engine processes (spawn, communicate, terminate). Exposes: spawn engine, send UCI command, listen for output, stop engine.
3. **Storage Adapter** — abstract interface for persistence (localStorage vs. filesystem). Exposes: get item, set item, remove item.

**Presentation Modules:**
1. **Router** — maps game IDs and routes to views. Setup: /game/:id, /settings, /analysis, /home.
15. **GameView** — layout: board (center), player panels (top/bottom), analysis/history/control panel (right). Exposes: game ID prop, move event, takeback event.
16. **Chessboard Component** — renders 64 squares, pieces, highlights, drag-drop. Exposes: board state prop, move event, flipped prop.
17. **PlayerPanel Component** — shows player name, time remaining, captured pieces, avatar. Exposes: player data prop.
18. **AnalysisPanel Component**  — list best engine moves, 1 line of thoughts per row, can fold per engine
19. **HistoryPanel Component** — tree visualization of moves, mainline highlighted, click to navigate. Exposes: move history prop, navigate event.
20. **GameControlPanel Component** — resign, take back, pause, enter analysis mode
21. **MenuBar Component** — new game, load game, settings, quit. Exposes: action events.
22. **SettingsView** — controls for time presets, piece/board style, engine config. Exposes: update setting event.
23. **NewGame Popup** — a prompt for settings for the new game like time control, choosing players (if engine, able to pick preset profile maybe)
24. **GameTab View** — hosting the game view and for switching to different games/analysis with tabs. when there are more than 1 game views otherwise act invisible to the user eye like there is only the game tab
25. **Home View** — show large buttons for most common actions, like starting new game, loading game, quick game with presets, list of previous games
26. Other common components for basic window management such as tabs, popups, buttons, etc.

---

**DEPENDENCY SUMMARY (no cycles):**

```
Platform Layer
    ↑
Domain Logic ← uses Platform for any I/O
    ↑
State Management ← uses Domain Logic + Platform
    ↑
Presentation ← uses State Management + Domain Logic
```
---

**DATA FLOW EXAMPLE (Player Makes Move):**

1. ChessboardComponent emits move event (from square, to square)
2. GameView catches event → calls `gamesStore.makeMove(gameId, move)`
3. gamesStore validates via Chess Engine (Domain)
4. If valid: updates game state (Move Tree, Time Control), marks game dirty
5. Settings store triggers auto-persist via Storage Adapter (Platform)
6. Analysis store (if engines running) queues position for analysis
7. GameView reactively updates (Chessboard, HistoryPanel, PlayerPanel re-render)
