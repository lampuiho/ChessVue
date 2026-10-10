import { z } from 'zod';

import { assignedEngineSchema, type IAssignedEngine } from './Engine';
import { type PlayerType, playerTypeSchema, resultReasonSchema, resultStateSchema } from './Game';
import { moveSchema, type IMove } from './Move';
import { type PlayerColour, playerColourSchema } from './Chess';

export const enum AppModalKind {
  NewGame = 'newGame',
  Promotion = 'promotion',
  StartGameFromSetup = 'startGameFromSetup',
  Resign = 'resign',
  DrawOffer = 'drawOffer',
  DrawResolve = 'drawResolve',
  Timeout = 'timeout',
  ImportError = 'importError',
  ResetSettings = 'resetSettings',
  DeleteGame = 'deleteGame',
  BoardEditBlocked = 'boardEditBlocked',
  SettingsDirtyLeave = 'settingsDirtyLeave',
  PlayerSelection = 'playerSelection',
  AnalysisEngineSelection = 'analysisEngineSelection',
}
export const enum BoardEditBlockedReason {
  InGameAnalysis = 'inGameAnalysis',
}
export const appModalKinds = [
  AppModalKind.NewGame,
  AppModalKind.Promotion,
  AppModalKind.StartGameFromSetup,
  AppModalKind.Resign,
  AppModalKind.DrawOffer,
  AppModalKind.DrawResolve,
  AppModalKind.Timeout,
  AppModalKind.ImportError,
  AppModalKind.ResetSettings,
  AppModalKind.DeleteGame,
  AppModalKind.BoardEditBlocked,
  AppModalKind.SettingsDirtyLeave,
  AppModalKind.PlayerSelection,
  AppModalKind.AnalysisEngineSelection,
] as const;
export const boardEditBlockedReasons = [BoardEditBlockedReason.InGameAnalysis] as const;

export type IAppModalState =
  | { kind: AppModalKind.NewGame }
  | {
    kind: AppModalKind.Promotion;
    payload: {
      gameId: string;
      move: IMove;
    };
  }
  | {
    kind: AppModalKind.StartGameFromSetup;
    payload: {
      gameId: string;
    };
  }
  | {
    kind: AppModalKind.Resign;
    payload: {
      gameId: string;
      colour: PlayerColour;
    };
  }
  | {
    kind: AppModalKind.DrawOffer;
    payload: {
      gameId: string;
      offeringColour: PlayerColour;
    };
  }
  | {
    kind: AppModalKind.DrawResolve;
    payload: {
      gameId: string;
      offeringColour: PlayerColour;
      respondingColour: PlayerColour;
    };
  }
  | {
    kind: AppModalKind.Timeout;
    payload: {
      gameId: string;
      resultState: 'drawn' | 'whiteWon' | 'blackWon' | 'abandoned';
      resultReason: 'timeout';
    };
  }
  | {
    kind: AppModalKind.ImportError;
    payload: {
      message: string;
    };
  }
  | { kind: AppModalKind.ResetSettings }
  | {
    kind: AppModalKind.DeleteGame;
    payload: {
      gameId: string;
    };
  }
  | {
    kind: AppModalKind.BoardEditBlocked;
    payload: {
      gameId: string;
      reason: BoardEditBlockedReason;
    };
  }
  | {
    kind: AppModalKind.SettingsDirtyLeave;
    payload: {
      targetRoute: string;
    };
  }
  | {
    kind: AppModalKind.PlayerSelection;
    payload: {
      gameId: string;
      colour: PlayerColour;
      currentPlayerType?: PlayerType;
      currentAssignedEngine?: IAssignedEngine;
    };
  }
  | {
    kind: AppModalKind.AnalysisEngineSelection;
    payload: {
      gameId: string;
      currentAnalysisEngines: IAssignedEngine[];
    };
  };
export const appModalKindSchema = z.enum(appModalKinds);
export const boardEditBlockedReasonSchema = z.enum(boardEditBlockedReasons);

export const appModalStateSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal(AppModalKind.NewGame),
  }),
  z.object({
    kind: z.literal(AppModalKind.Promotion),
    payload: z.object({
      gameId: z.string().min(1),
      move: moveSchema,
    }),
  }),
  z.object({
    kind: z.literal(AppModalKind.StartGameFromSetup),
    payload: z.object({
      gameId: z.string().min(1),
    }),
  }),
  z.object({
    kind: z.literal(AppModalKind.Resign),
    payload: z.object({
      gameId: z.string().min(1),
      colour: playerColourSchema,
    }),
  }),
  z.object({
    kind: z.literal(AppModalKind.DrawOffer),
    payload: z.object({
      gameId: z.string().min(1),
      offeringColour: playerColourSchema,
    }),
  }),
  z.object({
    kind: z.literal(AppModalKind.DrawResolve),
    payload: z.object({
      gameId: z.string().min(1),
      offeringColour: playerColourSchema,
      respondingColour: playerColourSchema,
    }),
  }),
  z.object({
    kind: z.literal(AppModalKind.Timeout),
    payload: z.object({
      gameId: z.string().min(1),
      resultState: resultStateSchema.refine((value) => value !== 'ongoing'),
      resultReason: resultReasonSchema.refine((value) => value === 'timeout'),
    }),
  }),
  z.object({
    kind: z.literal(AppModalKind.ImportError),
    payload: z.object({
      message: z.string().min(1),
    }),
  }),
  z.object({
    kind: z.literal(AppModalKind.ResetSettings),
  }),
  z.object({
    kind: z.literal(AppModalKind.DeleteGame),
    payload: z.object({
      gameId: z.string().min(1),
    }),
  }),
  z.object({
    kind: z.literal(AppModalKind.BoardEditBlocked),
    payload: z.object({
      gameId: z.string().min(1),
      reason: boardEditBlockedReasonSchema,
    }),
  }),
  z.object({
    kind: z.literal(AppModalKind.SettingsDirtyLeave),
    payload: z.object({
      targetRoute: z.string().startsWith('/'),
    }),
  }),
  z.object({
    kind: z.literal(AppModalKind.PlayerSelection),
    payload: z.object({
      gameId: z.string().min(1),
      colour: playerColourSchema,
      currentPlayerType: playerTypeSchema.optional(),
      currentAssignedEngine: assignedEngineSchema.optional(),
    }),
  }),
  z.object({
    kind: z.literal(AppModalKind.AnalysisEngineSelection),
    payload: z.object({
      gameId: z.string().min(1),
      currentAnalysisEngines: z.array(assignedEngineSchema),
    }),
  }),
]);
