# Layer 3 Alignment Backlog

## Purpose
Capture remaining layer-3 implementation review targets with direct source references, so follow-up work can be reviewed against the documented low-level design instead of inferred helper names.

## Remaining Review Targets
- Automatic pruning after exiting in-game analysis.
  - Source refs: [GameplayAndControl.md](ProcessFlows/GameplayAndControl.md#scn-hist-04---automatic-pruning-after-live-move-from-the-latest-node), [GamesStore.md](Architecture/StateManagement/GamesStore.md)
  - Review target: whether `makeMove(...)` prunes latest-node exploratory continuations only when live play resumes from the same in-game-analysis entry anchor.
- Restore-time analysis restart ownership.
  - Source refs: [GamesStore.md](Architecture/StateManagement/GamesStore.md), [StartupAndNavigation.md](ProcessFlows/StartupAndNavigation.md), [PersistenceAndAdministration.md](ProcessFlows/PersistenceAndAdministration.md)
  - Review target: whether `GamesStore.insertGame(...)` owns hydration plus settings-gated analysis resumption for restored or loaded games.
- Player reassignment live and paused obligations.
  - Source refs: [GamesStore.md](Architecture/StateManagement/GamesStore.md)
  - Review target: whether reassignment preserves the correct live or paused family, clears stale seat-specific runtime intent, and immediately requests a newly due non-local move when the game stays live.
- Post-timeout in-game analysis.
  - Source refs: [GamesStore.md](Architecture/StateManagement/GamesStore.md), [GameplayAndControl.md](ProcessFlows/GameplayAndControl.md)
  - Review target: whether timeout-ended games can enter and leave in-game analysis while preserving `resultState` and `resultReason`.
- Settings-driven historical-node move policy.
  - Source refs: [GameplayAndControl.md](ProcessFlows/GameplayAndControl.md)
  - Review target: whether historical-node moves honour the documented rewrite-mainline versus analysis-only policy and the configured analysis-branch exit behaviour.

## Explicit Inference To Track Separately
- Analysis snapshot reset semantics.
  - Source refs: [Analysis.md](Architecture/DataInterface/Analysis.md)
  - Inference: when analysis is restarted, stopped, or invalidated, stale `bestMove` or line payloads should not remain presented as the current latest-known result for the new snapshot state.
