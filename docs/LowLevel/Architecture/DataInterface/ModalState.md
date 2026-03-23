# Modal State Types

## Purpose
Define the typed transient modal states owned by `UiStateStore`.

## Types
- `type AppModalKind = "newGame" | "promotion" | "pruneFuture" | "startGameFromSetup" | "resign" | "drawOffer" | "drawResolve" | "timeout" | "importError" | "resetSettings" | "deleteGame" | "boardEditBlocked" | "settingsDirtyLeave" | "analysisExitDirty" | "playerSelection" | "analysisEngineSelection"`
- `type IAppModalState`

## Data Structures
```ts
type AppModalKind =
  | "newGame"
  | "promotion"
  | "pruneFuture"
  | "startGameFromSetup"
  | "resign"
  | "drawOffer"
  | "drawResolve"
  | "timeout"
  | "importError"
  | "resetSettings"
  | "deleteGame"
  | "boardEditBlocked"
  | "settingsDirtyLeave"
  | "analysisExitDirty"
  | "playerSelection"
  | "analysisEngineSelection"

type IAppModalState =
  | { kind: "newGame" }
  | {
      kind: "promotion"
      payload: {
        gameId: string
        move: IMove
      }
    }
  | {
      kind: "pruneFuture"
      payload: {
        gameId: string
        nodeId: string
      }
    }
  | {
      kind: "startGameFromSetup"
      payload: {
        gameId: string
      }
    }
  | {
      kind: "resign"
      payload: {
        gameId: string
        colour: PlayerColour
      }
    }
  | {
      kind: "drawOffer"
      payload: {
        gameId: string
        offeringColour: PlayerColour
      }
    }
  | {
      kind: "drawResolve"
      payload: {
        gameId: string
        offeringColour: PlayerColour
        respondingColour: PlayerColour
      }
    }
  | {
      kind: "timeout"
      payload: {
        gameId: string
        resultState: Exclude<ResultState, "ongoing">
        resultReason: "timeout"
      }
    }
  | {
      kind: "importError"
      payload: {
        message: string
        isRecoverable: boolean
      }
    }
  | { kind: "resetSettings" }
  | {
      kind: "deleteGame"
      payload: {
        gameId: string
      }
    }
  | {
      kind: "boardEditBlocked"
      payload: {
        gameId: string
        reason: "inGameAnalysis"
      }
    }
  | {
      kind: "settingsDirtyLeave"
      payload: {
        targetRoute: IGameSessionSnapshot["activeRoute"]
      }
    }
  | {
      kind: "analysisExitDirty"
      payload: {
        gameId: string
      }
    }
  | {
      kind: "playerSelection"
      payload: {
        gameId: string
        colour: PlayerColour
        currentPlayerType: PlayerType | null
        currentEngineId: string | null
      }
    }
  | {
      kind: "analysisEngineSelection"
      payload: {
        gameId: string
        assignedEngineIds: string[]
      }
    }
```

## Rules
- Modal state is transient UI state only and is never persisted in `IGameSessionSnapshot`, `IUiLayoutState`, or `IGameWorkspace`.
- The modal contract exists to replace untyped string IDs and generic payload bags at the store boundary.
- Dirty-settings-leave and dirty-analysis-exit prompts are part of the committed baseline modal contract because those branches already exist in the high-level scenarios.
- Player-selection and analysis-engine selection are part of the committed baseline modal contract because both flows are explicitly routed through shared dialog surfaces.
- `drawOffer` and `drawResolve` remain separate modal kinds so the baseline offer step and local-opponent response step stay explicit instead of being hidden inside one store call.
- `playerSelection` only captures the new seat assignment target. Fresh game settings for a later live restart remain part of `startGameFromSetup`.
