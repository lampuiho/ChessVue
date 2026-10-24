# Presentation interaction map

This map records the implemented Vue surfaces and their action owners. Views compose routes and retain shared workflow resources; feature components render their own markup, read store data directly and handle complete local interactions. Shared primitives retain their drawing/dialog contracts, and all styling comes from the global CSS entry. Proposed generic render-layer components in older design pages are not an extra implementation layer.

| Surface | Local owner and store calls | Retained boundary |
| --- | --- | --- |
| Home quick game | useQuickGame constructs accepted defaults, awaits createGame, opens the tab and navigates with owned busy/error/cancellation. | The same action is used by MenuBar; disposal suppresses late UI navigation. |
| Custom creation/setup | GameCreationModal owns form, validation, readiness checks and createGame/startGameFromSetup submission. | dismissed closes the captured modal opening. GameView retains custom creation's interrupted-game completion. |
| Recent/library selection | Home/SavedGamesView coordinate RecentGameStore/SavedGamesStore loading, GamesStore insertion and tab navigation. | Saved details and confirmations keep their captured operation/target owners. |
| Menu quick/close | MenuBar uses useQuickGame and useGameTabActions.close; gameId determines save/close availability. | Home, Custom, Load, Save and Settings events enter GameView's playback/Menu-pause workflow. There is no unused Delete action. |
| Game tabs | GameTabs reads session membership, canonical names and committed route; select/close use useGameTabActions. | App's route checkpoint publishes successful selection. Close clears only the target queue before removing the tab; switching preserves queues. Canonical games and saved files survive tab close. |
| Board input | Chessboard owns selection, drag, touch, palette and promotion gesture. | moveAttempted and premovesCancelled reach GameView's captured rendered owner. Five board-edit events target the canonical game through store guards and root/history handling. |
| History | HistoryPanel reads reactive tree/paths, owns saved folds and resolves both row and Live position targets. | nodeSelected enters GameView's playback/continuation cancellation workflow before store navigation. |
| Analysis management | AnalysisPanel reads canonical seats and settings, owns folds, refresh/retry/stop and add/remove. Assignment removal reconciles its fold entry. | moveSelected retains stable raw entry references and enters GameView's due-turn, off-turn or exploratory routing. |
| Player strip | PlayerPanel reads its game's colour seat and opens PlayerSelectionModal directly. | GameView supplies the shared clock/active-turn/captured-material projections and playback lock. |
| Controls | GameControlPanel owns manual pause/resume, board edit, setup start, resignation and draw negotiation through public GamesStore methods. | Takeback and analysis entry/exit events retain GameView's captured input owner, playback drain and continuation dismissal. |
| Settings/profile | SettingsView owns draft actions and EngineProfileModal's seed/replacement destination. | Successful Apply/Save/Reset emits appearanceChanged to App; dirty navigation remains captured by its confirmation. |
| Navigation drawer | NavigationFrame owns expansion/opening and NavigationMenuModal renders the same brand/actions/footer slot closures. | The modal provider owns exact mounted-opening dismissal and focus cleanup. |

GameView retains one clock timer, timeout notice, rendered canonical/premove snapshot, playback OperationOwner, historical continuation, Menu interruption and route activation. It does not forward player, seat, tree, fold or independent control actions. All mutations still cross existing store/domain boundaries; no rule, engine-resource or persistence implementation is moved into a component.

Premove displayPosition remains distinct from canonical position. The endpoint set and eligible local colour drive artwork/cancellation and candidate selection. Board/PV input retains raw entries: local due play submits the first suggestion; eligible off-turn selection submits only the clicked local candidate after parity/projected-geometry checks; explicit/free/result analysis plays the selected canonical prefix. No opponent replies are enqueued from a PV.

Panels read reactive fields and arrays, including in-place history and seat changes, without a revision prop or clock tick. They save their explicit fold actions through UiStateStore and show local failures. Paused analysis retains its existing exploration permissions; analysis management and player reassignment remain available during genuine pauses while board edit blocks engine startup/player changes.

[Shared dialog flows](SharedDialogFlows.md) records provider lifetime, local form submission, captured confirmations, draw response, promotion, profile editing and mobile navigation. The small modal action helper prevents duplicate starts and suppresses late UI errors/dismissal; it does not dispatch commands or own a global current dialog. Existing domain work keeps its completion semantics.
