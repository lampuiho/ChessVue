# Composables and Directives

Presentation composables live in `src/composables` and the focus directive in `src/directives`, outside `src/components`, which holds `.vue` files only. Each composable uses the `useXxxx` naming pattern and keeps its implementation return types inferred. The app shell that initialises the modal provider is described in [Presentation Architecture](index.md#app-shell).

## ModalComposable
Source: [`src/composables/ModalComposable.ts`](../../../../src/composables/ModalComposable.ts)

### Contracts
```ts
type ModalProps<C>; // the SFC's public props, omitting the provider-supplied signal and onDismissed
interface IModalHandle {
  readonly signal: AbortSignal;
  close: () => Promise<void>;
}
interface IModalController {
  open<C extends Component>(component: C, props: ModalProps<C>, onClosed?: () => void | Promise<void>): IModalHandle;
}
```

| Function | Responsibility |
| --- | --- |
| `useModalProvider()` | Called once from `App` setup. Captures the app context, publishes the controller with `app.provide` and registers disposal with `onScopeDispose`. A second initialisation in the same app throws. |
| `useModal()` | Injects the controller. Throws if the provider was not initialised; it never creates a second owner. |
| `open(component, props, onClosed?)` | Detaches the previous opening, mounts a fresh instance of `component` into a new container on `document.body` with the app context, then settles the previous opening's completion. Returns the new opening's `signal` and a `close` bound to that opening. Throws after disposal; a failed mount is cleaned up and rethrown. |

Each opening owns its container, `AbortController`, `onClosed` callback and a cached close completion. The mounted component receives `signal` and an `onDismissed` listener bound to its own opening, so emitting `dismissed` closes that opening only. Closing aborts the signal, unmounts the component, removes the container and runs `onClosed` once; callback failures are logged with `logHandledError`. Closing a replaced or already closed handle is harmless. On app disposal the active opening is closed and callbacks that have not started are skipped, so teardown never resumes a Menu pause or navigates.

Only one modal is active at a time. Opening another modal replaces the current one, which is how chained flows such as the draw offer and draw response hand over. Because every opening remounts the component, each opening starts with fresh local form state, including when the same component and props object are reused.

The [modal component design](../../../ArchivedPlans/ModalComponentDesign.md) records why this replaced the earlier `ModalHost` and `UiStateStore` modal state. A global "current dialog" let a late close or late error from one opening affect its replacement, and a host dispatching on modal kinds needed a registry and a watcher to reset forms. Binding dismissal and completion to the captured opening removes that class of bug. The invariant is that closing, completion and late UI delivery always target the opening that started them. Revisit if two dialogs must ever be visible at once.

## ModalActionComposable
Source: [`src/composables/ModalActionComposable.ts`](../../../../src/composables/ModalActionComposable.ts)

`useModalAction(signal: AbortSignal)` returns `{ isWorking, errorMessage, run }`.

- `run(action)` returns `false` without starting when an action is already running or the signal is aborted. Otherwise it sets `isWorking`, clears `errorMessage`, awaits `action()` and returns `true` only if the opening is still live.
- A failure sets `errorMessage` from an `Error` or platform error message (or a generic message) unless the opening has been aborted, and returns `false` so the form stays open for retry.
- Used by `GameCreationModal`, `PlayerSelectionModal`, `AnalysisEngineSelectionModal`, `DrawResponseModal`, `ConfirmationModal` and `GameResultModal`. The caller emits `dismissed` after a successful `run`.

The helper replaced five copies of the same busy/error/abort wrapper. It deliberately does not close whichever modal is current, dispatch commands, restart work reactively or roll back an already-started domain mutation; feature components keep their own work, cancellation policy and chained transitions ([component simplification plan, action 5](../../../ArchivedPlans/ComponentSimplificationPlan.md#5-reduce-repeated-modal-action-code)).

## GameTabActionsComposable
Source: [`src/composables/GameTabActionsComposable.ts`](../../../../src/composables/GameTabActionsComposable.ts)

`useGameTabActions()` returns `{ select, close }`. Callers are `GameTabs`, `MenuBar` and `GameResultModal`.

- `select(id)` returns `router.push('/game/:id')`. It does not publish the selection; the App route checkpoint does that after the navigation succeeds, so a rejected navigation leaves the selection unchanged.
- `close(id)` ignores a target that is not an open tab or is already closing in this composable instance. It clears that game's premoves with `GamesStore.clearPremoves`, calls `UiStateStore.closeTab(id)` and then navigates to the session's active game or `/home`.

The close order is deliberate: only the closing game's queue is cleared, and it is cleared before the tab disappears. Temporary tab switching and route visits preserve every queue. Closing a tab does not delete the workspace game, its saved files or its actual turn. These rules come from the premove boundary matrix and are covered by PRE-S19 ([component simplification plan, action 3](../../../ArchivedPlans/ComponentSimplificationPlan.md#3-let-tabs-and-the-game-menu-own-independent-actions)).

## QuickGameComposable
Source: [`src/composables/QuickGameComposable.ts`](../../../../src/composables/QuickGameComposable.ts)

`useQuickGame()` returns `{ start, isWorking, errorMessage }`. `HomeView` and `MenuBar` use it, so both Quick game buttons create the same game. It must be called in a component rendered under a `RouterView`, because it registers route hooks.

`start()`:

1. Returns if a start is already running or accepted settings are not loaded.
2. Validates the accepted `gameDefaults` with `getGameCreationError` and copies them with `copyGameRequest`. A request with an unassigned seat creates free analysis and sets `showLiveAnalysisMoves` to `true`.
3. Inside its `OperationOwner`, checks each engine player of a live game (both seats assigned) with `EngineRuntimeService.getOptions`, creates the game with `GamesStore.createGame`, opens its tab and navigates to `/game/:id`, checking the abort signal between steps.
4. Shows a failure in `errorMessage`. Home and MenuBar offer *Edit game defaults* beside a quick-game error.

`onBeforeRouteLeave` and `onBeforeRouteUpdate` cancel the owner, and `onScopeDispose` disposes it, so a start abandoned by navigation or unmount cannot open a tab or navigate later. Cancellation does not roll back a game that `createGame` has already inserted. Quick game adds no Menu pause. See the [quick game defaults design](../../../ArchivedPlans/QuickGameDefaultsDesign.md#ownership-and-creation-flows) for why accepted defaults, never an unsaved settings draft, seed creation.

## FocusScope Directive
Source: [`src/directives/FocusScope.ts`](../../../../src/directives/FocusScope.ts)

`vFocusScope` is an object directive applied by `ModalDialog` and `NavigationMenuModal`.

- **Mounted:** records the element that had focus, pushes the scope onto a module-level stack and focuses the first `autofocus` control, else the first focusable control, else the scope element. While it is the top scope it keeps focus inside (`focusin` on the document), cycles Tab and Shift+Tab, and recovers focus when the focused element is removed.
- **Unmounted:** removes its listeners and leaves the stack. If it was the top scope, focus returns to its opener when that element is still connected, available and inside the next scope; otherwise to the next scope's initial control, else to the first focusable control in `main`.

The stack lets nested and chained dialogs restore focus to a surviving launcher. Listeners exist exactly as long as the dialog's DOM, with no observer, timer or invalidation mechanism ([code cleanup plan](../../../ArchivedPlans/CodeCleanupPlan.md#async-ownership-decisions)).
