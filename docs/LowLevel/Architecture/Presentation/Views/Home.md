# HomeView

Home renders launch/no-active-game actions and on-demand recent games. It never auto-creates a workspace.

Quick game uses the same `useQuickGame` action as MenuBar: accepted defaults, two local players, owned busy/error feedback and cancellation of unstarted UI follow-up on route/lifecycle replacement. The Home button disables while its creation is pending. Custom creation opens GameCreationModal, which owns its form and submission.

Load and Settings request their routes directly. RecentGameStore supplies recent entries; SavedGamesStore loads a selected snapshot and GamesStore inserts the canonical workspace. Home opens its tab and navigates, retaining local pending/error feedback and refreshing recent entries on failure.

The action row and optional recent grid use Home's markup and the global CSS modules; no permanently resident recent-games subscription is added.
