# Views

## Route Views
- [HomeView](Home.md)
- [GameView](Game.md)
- [SavedGamesView](SavedGames.md)
- [SettingsView](Settings.md)

## Settings Child Views
These render inside `SettingsView` through its `RouterView`; see [nested engine routes](../Router.md#nested-engine-routes).
- [EngineProfileView](EngineProfile.md)
- [EnginePackageImportView](EnginePackageImport.md)
- [EnginePackageDetailsView](EnginePackageDetails.md)

## Supporting Docs
- [Router](../Router.md)
- [Interaction Map](../InteractionMap.md)
- [Shared Dialog Flows](../SharedDialogFlows.md)
- [App Shell](../index.md#app-shell)

## Rules
- Views are route components in `src/views`, lazily loaded by the router. `App` renders them through `RouterView` only after startup has loaded settings, the game session and layout state.
- Views own their page markup, compose feature components and own route-level workflows: navigation, route hooks, route-level confirmations and resources shared by several child components.
- Views read store state directly and call public store actions. They do not implement business rules that belong to domain services or state stores, such as move legality, latest-save selection, serialisation or engine lifecycle.
- The game, library and settings pages place their actions in a `NavigationFrame` (the game page through `MenuBar`); Home renders its own header and action cards.
- Views follow the [presentation rules](../index.md): global CSS only, no watchers and explicit owners for async work.
