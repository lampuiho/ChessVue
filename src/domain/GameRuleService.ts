import { applyMove, generateLegalMoves, isMoveLegal, requiresPromotionSelection, resolveResult } from '@/utility/chess';

export const GameRuleService = {
  generateLegalMoves,
  isMoveLegal,
  requiresPromotionSelection,
  applyMove,
  resolveResult,
};
