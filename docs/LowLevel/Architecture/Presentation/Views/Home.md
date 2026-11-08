# HomeView

Source: [`src/views/HomeView.vue`](../../../../../src/views/HomeView.vue) · Route: `/home`

## Purpose
Render the launch screen: start actions and up to three recent games. Home never creates a workspace automatically.

## Dependencies
- Stores: `GamesStore` (`getGame`, `insertGame`), `RecentGameStore.getRecentGames`, `SavedGamesStore.loadRecentGame`, `UiStateStore.openTab`.
- Composables: `useQuickGame`, `useModal`.
- Children: `GameCreationModal` (mounted), `AppIcon`.
- Styles: `home.css`; action cards and messages from `shared.css`.

## Behaviour
- **Quick game** calls `useQuickGame().start`, shared with `MenuBar`: accepted defaults, required-engine readiness, owned busy/error state and cancellation of unstarted UI follow-up on route or lifecycle replacement. The card is disabled while its creation is pending. A quick-game error shows *Edit game defaults*, which opens `/settings/gameplay`.
- **Custom game** opens `GameCreationModal` with no `gameId`; the modal owns its form and submission.
- **Load game** and **Settings** navigate to `/saved-games/load` and `/settings/session`.
- `onMounted` reads recent entries once; there is no resident recent-games subscription. While they load, Home shows *Looking for recent games…*.
- Selecting a recent card reuses the open workspace game when it exists, otherwise loads it with `SavedGamesStore.loadRecentGame` and inserts it with `GamesStore.insertGame`. Home then opens its tab and navigates to `/game/:id`. The card is disabled while pending; a failure shows an inline error and refreshes the recent list. *View all* opens the library.

## Notes
- Home has no `NavigationFrame`; it renders its own `.home-header` and footer.
- Recent cards show the display name, Autosaved or Saved, and the save date.
