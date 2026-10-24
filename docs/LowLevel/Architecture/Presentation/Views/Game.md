# GameView

GameView composes MenuBar, GameTabs, Chessboard, two PlayerPanels, HistoryPanel, AnalysisPanel and GameControlPanel for the route's canonical game. Feature components read their own game data by ID rather than receive copied player, tree, seat or menu-capability props.

The view retains the rendered board/input owner, canonical and premove projection distinction, selected/live position reads, one clock timer and timeout notification, captured-material grouping, playback OperationOwner and historical continuation. Its retained control actions bind takeback and analysis entry/exit to the actual rendered context before draining playback and mutating through GamesStore.

Board raw input and completed promotion feed the same captured move action. Off-turn input appends the supplied raw reference without canonical prefix preflight. PV routing submits the first move on a local due turn, only the clicked local candidate when off-turn, or the legal prefix during explicit/free/result analysis. Captured premove cancellation drains playback and clears the correct game's queue. Mode/permission and projection replacement clear the prior gesture owner; background queue edits do not replace unrelated analysis input.

History row and Live position selection both enter `_navigateToNode`, which cancels playback and continuation before store navigation. AnalysisPanel owns its folds and engine management; PlayerPanel opens its own chooser; GameControlPanel owns pause, setup, board editing, draw and resignation. These components continue to call the public store coordination methods.

GameView retains five Menu interruption events. It cancels playback and applies PauseReason.Menu before configured navigation/custom creation. Custom creation captures the interrupted game in its close completion; activation resumes only that Menu pause owner. Route update/leave and unmount cancel owned playback. Autosave failure feedback registers one consumer and disposes it on unmount.

GameTabs owns route-driven selection. GameTabs/MenuBar share explicit tab close, including target-only premove clearing; temporary route changes preserve queues. The view chooses whether history/analysis regions mount from shared visibility preferences and supplies their playback-sensitive disabled flags. It supplies the common control mode and takeback eligibility, while the control panel derives pause and draw status locally.

All markup uses the shared global stylesheets. No watcher, publication counter or separate presentation query layer is used.
