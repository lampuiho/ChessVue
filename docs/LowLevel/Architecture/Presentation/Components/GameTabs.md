# GameTabs

The component has no props or emits. It reads open-game membership from `UiStateStore`, game names and ordering from `GamesStore`, and the active committed game ID from the route. The strip hides when at most one game is open.

`useGameTabActions.select(id)` requests `/game/:id` without publishing a selected tab before navigation. App's committed-route hook updates the session; rejected navigation leaves selection unchanged.

`useGameTabActions.close(id)` is shared with MenuBar. It clears only the target game's premoves, closes that tab and navigates to the current fallback or Home. Active, background and paused tabs use the same order. Temporary switching retains queues. Closing a tab does not delete a saved game, remove the canonical workspace game or dispose its actual turn.

Duplicate closes for the same pending target are ignored. Action errors stay in the mounted component and cannot publish after disposal. Keyboard close and pointer close use the same action.
