# Modal State Types

## Purpose
Define the typed transient modal states owned by `UiStateStore`.

## Types
- `enum AppModalKind`
- `enum BoardEditBlockedReason`
- `type IAppModalState`

## Data Structures
```ts
enum AppModalKind {
  NewGame = "newGame",
  Promotion = "promotion",
  StartGameFromSetup = "startGameFromSetup",
  Resign = "resign",
  DrawOffer = "drawOffer",
  DrawResolve = "drawResolve",
  Timeout = "timeout",
  ImportError = "importError",
  ResetSettings = "resetSettings",
  DeleteGame = "deleteGame",
  BoardEditBlocked = "boardEditBlocked",
  SettingsDirtyLeave = "settingsDirtyLeave",
  PlayerSelection = "playerSelection",
  AnalysisEngineSelection = "analysisEngineSelection"
}

enum BoardEditBlockedReason {
  InGameAnalysis = "inGameAnalysis"
}

type IAppModalState =
  | { kind: AppModalKind.NewGame }
  | {
      kind: AppModalKind.Promotion
      payload: {
        gameId: string
        move: IMove
      }
    }
  | {
      kind: AppModalKind.StartGameFromSetup
      payload: {
        gameId: string
      }
    }
  | {
      kind: AppModalKind.Resign
      payload: {
        gameId: string
        colour: PlayerColour
      }
    }
  | {
      kind: AppModalKind.DrawOffer
      payload: {
        gameId: string
        offeringColour: PlayerColour
      }
    }
  | {
      kind: AppModalKind.DrawResolve
      payload: {
        gameId: string
        offeringColour: PlayerColour
        respondingColour: PlayerColour
      }
    }
  | {
      kind: AppModalKind.Timeout
      payload: {
        gameId: string
        resultState: Exclude<ResultState, ResultState.Ongoing>
        resultReason: ResultReason.Timeout
      }
    }
  | {
      kind: AppModalKind.ImportError
      payload: {
        message: string
      }
    }
  | { kind: AppModalKind.ResetSettings }
  | {
      kind: AppModalKind.DeleteGame
      payload: {
        gameId: string
      }
    }
  | {
      kind: AppModalKind.BoardEditBlocked
      payload: {
        gameId: string
        reason: BoardEditBlockedReason
      }
    }
  | {
      kind: AppModalKind.SettingsDirtyLeave
      payload: {
        targetRoute: IGameSessionSnapshot["activeRoute"]
      }
    }
  | {
      kind: AppModalKind.PlayerSelection
      payload: {
        gameId: string
        colour: PlayerColour
        currentPlayerType?: PlayerType
        currentAssignedEngine?: IAssignedEngine
      }
    }
  | {
      kind: AppModalKind.AnalysisEngineSelection
      payload: {
        gameId: string
        currentAnalysisEngines: IAssignedEngine[]
      }
    }
```

## Rules
- Modal state is transient UI state only and is never persisted in `IGameSessionSnapshot`, `IUiLayoutState`, or `IGame`.
- The modal contract exists to replace untyped string IDs and generic payload bags at the store boundary.
- Dirty-settings-leave prompts are part of the committed baseline modal contract because that branch already exists in the high-level scenarios.
- Player-selection and analysis-engine selection are part of the committed baseline modal contract because both flows are explicitly routed through shared dialog surfaces.
- `AppModalKind.DrawOffer` and `AppModalKind.DrawResolve` remain separate modal kinds so the baseline local-versus-local offer step and response step stay explicit instead of being hidden inside one store call.
- Non-local draw responses do not require a modal; they surface through the draw-control LED-like pending-offer indicator while still being allowed to call `acceptDrawOffer` or `declineDrawOffer` if an adapter-driven response channel ever exists. The same lit control also serves as the withdraw path for unresolved outgoing non-local offers.
- `AppModalKind.PlayerSelection` only captures the new seat assignment target. Fresh game settings for a later live restart remain part of `AppModalKind.StartGameFromSetup`.
- `AppModalKind.ImportError` is acknowledge-only in the baseline because unsupported, corrupt, and incomplete imports all resolve to one unrecoverable invalid-document path.
