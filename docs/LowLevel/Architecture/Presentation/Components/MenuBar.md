# MenuBar

The sole prop is `gameId`, the target workspace. Save/close availability follows whether that game exists. The old invariant capability flags and unused Delete action are removed.

Quick creation runs locally through `useQuickGame`, shared with Home. It uses accepted quick defaults, prevents duplicate submission and cancels UI follow-up on route/lifecycle replacement. It retains the existing two-local-player request and adds no Menu pause. Close calls the same `useGameTabActions.close` used by GameTabs, including target-only premove cancellation. Failures appear in the menu footer.

Five events retain the view-owned interruption boundary: `homeRequested`, `customNewGameRequested`, `loadGameRequested`, `saveGameRequested` and `settingsRequested`. GameView cancels playback, applies the configured Menu pause and owns activation/completion. Custom creation also captures the interrupted game in its exactly-once close callback.

NavigationFrame owns the desktop expansion and mobile drawer. Its slots render the same action closures in both surfaces.
