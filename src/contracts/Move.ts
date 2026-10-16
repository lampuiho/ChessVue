import { z } from 'zod';
import { createRecordedAnalysisSchema, type IRecordedAnalysis } from './AnalysisSeat';
import { checkStateSchema, type CheckState } from './ChessboardState';
import { clockSnapshotSchema, type IClockSnapshot } from './TimeControl';
import { boardIdSchema, pieceKindSchema, playerColourSchema, type BoardId, type PieceKind, type PlayerColour } from './Chess';

export const enum MoveKind {
  Normal = 'normal',
  Castle = 'castle',
  EnPassant = 'enPassant',
  Promotion = 'promotion',
}
export const enum MoveNodeKind {
  Live = 'live',
  Analysis = 'analysis',
}
export const enum AmbiguityKind {
  SameRankOnly = 'rank',
  SameFileOnly = 'file',
  Both = 'both',
}
const moveKinds = [MoveKind.Normal, MoveKind.Castle, MoveKind.EnPassant, MoveKind.Promotion] as const;
const moveNodeKinds = [MoveNodeKind.Live, MoveNodeKind.Analysis] as const;
const ambiguityKinds = [AmbiguityKind.SameRankOnly, AmbiguityKind.SameFileOnly, AmbiguityKind.Both] as const;

export type MovePath = number[];

export interface IMoveRuntime {
  ponderMove?: IMove; // moves (only 1 for now) suggested to speculate on
  san?: string; //cached san string, lazily built and assigned
  uci?: string; //cached uci string, lazily built and assigned
}
export interface IMoveRaw {
  from: BoardId;
  to: BoardId;
  promotionPiece?: PieceKind;
  $?: IMoveRuntime;
}
export interface IMoveCandidate extends IMoveRaw {
  kind: MoveKind;
  movingColour: PlayerColour;
  movingPiece: PieceKind;
  capturePiece?: PieceKind;
}
export interface IMove extends IMoveCandidate {
  checkState?: CheckState;
  ambiguityKind?: AmbiguityKind;
}
export interface IPromoMove extends IMove {
  kind: MoveKind.Promotion;
  promotionPiece: PieceKind;
}
export interface IMoveNodeRuntime {
  parent?: IMoveNode;
  isHighlighted?: boolean;
}
export interface IMoveNode {
  kind: MoveNodeKind;
  move?: IMove;
  clockSnapshot?: IClockSnapshot;
  recordedAnalysis?: IRecordedAnalysis;
  plyIndex: number;
  mainlineChildIndex?: number;
  children: IMoveNode[];
  $?: IMoveNodeRuntime;
}
export interface IMoveTree {
  root: IMoveNode;
}
export const moveKindSchema = z.enum(moveKinds);
export const moveNodeKindSchema = z.enum(moveNodeKinds);
export const ambiguityKind = z.enum(ambiguityKinds);
export const movePathSchema = z.array(z.number().int().min(0));

type IMoveSchemaInput = Omit<IMove, 'promotionPiece' | '$'> & { promotionPiece?: PieceKind | null };
export const moveSchema: z.ZodType<IMove, z.ZodTypeDef, IMoveSchemaInput> = z.object({
  from: boardIdSchema,
  to: boardIdSchema,
  kind: moveKindSchema,
  movingColour: playerColourSchema,
  movingPiece: pieceKindSchema,
  capturePiece: pieceKindSchema.optional(),
  checkState: checkStateSchema.optional(),
  ambiguityKind: ambiguityKind.optional(),
  promotionPiece: pieceKindSchema.optional(),
});
type IMoveInput = IMoveSchemaInput;
export const recordedAnalysisSchema = createRecordedAnalysisSchema(moveSchema);
interface IMoveNodeInput {
  kind: MoveNodeKind;
  move?: IMoveInput | null;
  clockSnapshot?: z.input<typeof clockSnapshotSchema> | null;
  recordedAnalysis?: z.input<typeof recordedAnalysisSchema>;
  plyIndex: number;
  mainlineChildIndex?: number | null;
  children: IMoveNodeInput[];
}
interface IMoveTreeInput {
  root: IMoveNodeInput;
}
export const moveNodeSchema: z.ZodType<IMoveNode, z.ZodTypeDef, IMoveNodeInput> = z.lazy(() =>
  z.object({
    kind: moveNodeKindSchema,
    move: moveSchema.optional(),
    clockSnapshot: clockSnapshotSchema.optional(),
    recordedAnalysis: recordedAnalysisSchema.optional(),
    plyIndex: z.number().int().min(0),
    mainlineChildIndex: z.number().int().min(0).optional(),
    children: z.array(moveNodeSchema),
  }),
);
export const moveTreeSchema: z.ZodType<IMoveTree, z.ZodTypeDef, IMoveTreeInput> = z.object({
  root: moveNodeSchema,
});
