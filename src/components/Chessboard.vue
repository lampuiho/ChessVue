<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { BoardOrientation, PieceKind, PlayerColour, type BoardId, type IBoardPosition, type IChessPiece, type IMove, type IMoveRaw } from '@/contracts';
import { genLegalMovesForPiece, toDetailedMove } from '@/utility/chess';
import AppIcon from './common/AppIcon.vue';

const props = withDefaults(defineProps<{
  position: IBoardPosition;
  orientation?: BoardOrientation;
  showCoordinates?: boolean;
  highlightLastMove?: boolean;
  lastMove?: IMove;
  inputDisabled?: boolean;
  boardEdit?: boolean;
}>(), { orientation: BoardOrientation.White, showCoordinates: true, highlightLastMove: true, inputDisabled: false, boardEdit: false });
const emit = defineEmits<{
  moveAttempted: [move: IMove];
  chessPieceToggled: [boardId: BoardId, piece: IChessPiece];
  chessPieceDeleted: [boardId: BoardId];
  chessPieceMoved: [from: BoardId, to: BoardId];
  boardCleared: [];
  boardReset: [];
}>();
const selectedBoardId = ref<BoardId>();
const pendingPromotionMoves = ref<IMoveRaw[]>([]);
const draggedBoardId = ref<BoardId>();
const editPiece = ref<{ kind: PieceKind; colour: PlayerColour }>({ kind: PieceKind.Queen, colour: PlayerColour.White });
const pieceKinds = [PieceKind.King, PieceKind.Queen, PieceKind.Rook, PieceKind.Bishop, PieceKind.Knight, PieceKind.Pawn];
const displayedBoardIds = computed<BoardId[]>(() => {
  const ids: BoardId[] = [];
  const ranks = props.orientation === BoardOrientation.White ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const files = props.orientation === BoardOrientation.White ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  for (const rank of ranks) for (const file of files) ids.push((rank * 8) + file);
  return ids;
});
const legalMoves = computed(() => selectedBoardId.value === undefined ? [] : genLegalMovesForPiece(props.position, selectedBoardId.value, props.lastMove));
const glyphByPiece = {
  white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
  black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
} as const;
const fileNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

watch(() => props.position, () => clearSelection());
watch(() => props.boardEdit, () => clearSelection());
function pieceGlyph(piece: IChessPiece): string {
  return glyphByPiece[piece.colour][piece.kind];
}
function isLegalTarget(boardId: BoardId): boolean {
  return legalMoves.value.some((move) => move.to === boardId);
}
function clearSelection(): void {
  selectedBoardId.value = undefined;
  pendingPromotionMoves.value = [];
}
function selectSquare(boardId: BoardId): void {
  if (props.inputDisabled) return;
  if (props.boardEdit) {
    emit('chessPieceToggled', boardId, { ...editPiece.value });
    return;
  }
  const piece = props.position.board[boardId];
  if (selectedBoardId.value === undefined) {
    if (piece?.colour === props.position.sideToMove) selectedBoardId.value = boardId;
    return;
  }
  if (piece?.colour === props.position.sideToMove) {
    selectedBoardId.value = boardId;
    return;
  }
  commitTarget(boardId);
}
function commitTarget(boardId: BoardId): void {
  const matchingMoves = legalMoves.value.filter((move) => move.to === boardId);
  if (matchingMoves.length === 0) {
    clearSelection();
    return;
  }
  if (matchingMoves.length > 1 && matchingMoves.some((move) => move.promotionPiece)) {
    pendingPromotionMoves.value = matchingMoves;
    return;
  }
  emitMove(matchingMoves[0]!);
}
function emitMove(rawMove: IMoveRaw): void {
  emit('moveAttempted', toDetailedMove(props.position, rawMove));
  clearSelection();
}
function choosePromotion(kind: PieceKind): void {
  const move = pendingPromotionMoves.value.find((candidate) => candidate.promotionPiece === kind);
  if (move) emitMove(move);
}
function onDragStart(boardId: BoardId, event: DragEvent): void {
  if (props.inputDisabled || !props.position.board[boardId]) {
    event.preventDefault();
    return;
  }
  draggedBoardId.value = boardId;
  selectedBoardId.value = boardId;
  event.dataTransfer?.setData('text/plain', String(boardId));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}
function onDrop(boardId: BoardId): void {
  const from = draggedBoardId.value;
  draggedBoardId.value = undefined;
  if (from === undefined) return;
  if (props.boardEdit) emit('chessPieceMoved', from, boardId);
  else commitTarget(boardId);
}
function onContextMenu(boardId: BoardId): void {
  if (props.boardEdit) emit('chessPieceDeleted', boardId);
}
function isLastMoveSquare(boardId: BoardId): boolean {
  return !!props.highlightLastMove && (props.lastMove?.from === boardId || props.lastMove?.to === boardId);
}
function showRank(index: number): boolean {
  return props.showCoordinates && index % 8 === 0;
}
function showFile(index: number): boolean {
  return props.showCoordinates && index >= 56;
}
</script>

<template>
  <div class="board-area">
    <div class="board-frame">
      <div class="board-grid" :class="{ 'board-grid--disabled': inputDisabled, 'board-grid--editing': boardEdit }">
        <button
          v-for="(boardId, index) in displayedBoardIds"
          :key="boardId"
          class="board-square"
          :class="{
            'board-square--light': (Math.floor(boardId / 8) + boardId % 8) % 2 === 1,
            'board-square--dark': (Math.floor(boardId / 8) + boardId % 8) % 2 === 0,
            'board-square--selected': selectedBoardId === boardId,
            'board-square--target': isLegalTarget(boardId),
            'board-square--capture': isLegalTarget(boardId) && !!position.board[boardId],
            'board-square--last': isLastMoveSquare(boardId),
          }"
          :aria-label="`${fileNames[boardId % 8]}${Math.floor(boardId / 8) + 1}${position.board[boardId] ? ` ${position.board[boardId]?.colour} ${position.board[boardId]?.kind}` : ''}`"
          @click="selectSquare(boardId)"
          @contextmenu.prevent="onContextMenu(boardId)"
          @dragover.prevent
          @drop.prevent="onDrop(boardId)"
        >
          <span v-if="showRank(index)" class="coordinate coordinate--rank">{{ Math.floor(boardId / 8) + 1 }}</span>
          <span v-if="showFile(index)" class="coordinate coordinate--file">{{ fileNames[boardId % 8] }}</span>
          <span v-if="position.board[boardId]" class="chess-piece" :class="`chess-piece--${position.board[boardId]?.colour}`" :draggable="!inputDisabled" @dragstart.stop="onDragStart(boardId, $event)">{{ pieceGlyph(position.board[boardId]!) }}</span>
          <span v-if="isLegalTarget(boardId) && !position.board[boardId]" class="move-dot"></span>
        </button>
        <div v-if="pendingPromotionMoves.length" class="promotion-popover">
          <span>Promote to</span>
          <div><button v-for="kind in [PieceKind.Queen, PieceKind.Rook, PieceKind.Bishop, PieceKind.Knight]" :key="kind" @click="choosePromotion(kind)">{{ pieceGlyph({ kind, colour: position.sideToMove }) }}</button></div>
          <button class="promotion-popover__cancel" @click="clearSelection">Cancel</button>
        </div>
      </div>
    </div>
    <div v-if="boardEdit" class="piece-palette surface">
      <div class="piece-palette__label"><strong>Position editor</strong><span>Choose a piece, then click a square. Right-click removes.</span></div>
      <div class="piece-palette__pieces">
        <button v-for="colour in [PlayerColour.White, PlayerColour.Black]" :key="colour" class="palette-colour" :class="`palette-colour--${colour}`" :aria-label="`${colour} pieces`" @click="editPiece.colour = colour">{{ colour === PlayerColour.White ? '○' : '●' }}</button>
        <span class="palette-divider"></span>
        <button v-for="kind in pieceKinds" :key="kind" :class="{ active: editPiece.kind === kind }" :aria-label="kind" @click="editPiece.kind = kind">{{ pieceGlyph({ kind, colour: editPiece.colour }) }}</button>
      </div>
      <div class="piece-palette__actions"><button class="text-button text-button--ghost" @click="emit('boardCleared')"><AppIcon name="trash" />Clear</button><button class="text-button" @click="emit('boardReset')"><AppIcon name="rotate" />Reset</button></div>
    </div>
  </div>
</template>

<style scoped>
.board-area { display: grid; gap: 0.65rem; justify-items: center; }
.board-frame { width: 100%; padding: 0.45rem; border-radius: 0.48rem; background: #39291f; box-shadow: 0 1.125rem 2.5rem rgb(24 17 12 / 24%), 0 0.1875rem 0.5rem rgb(24 17 12 / 25%); }
.board-grid { position: relative; display: grid; width: 100%; aspect-ratio: 1; grid-template-columns: repeat(8, 1fr); overflow: hidden; }
.board-grid--disabled { cursor: not-allowed; }
.board-square { position: relative; display: grid; min-width: 0; padding: 0; place-items: center; border-radius: 0; overflow: hidden; }
.board-square--light { color: #7a4d2c; background: #e8d8b9; }
.board-square--dark { color: #e8d8b9; background: #9b6744; }
.board-square--last::before { position: absolute; inset: 0; background: rgb(224 174 55 / 42%); content: ''; }
.board-square--selected::before { position: absolute; z-index: 1; inset: 0; box-shadow: inset 0 0 0 0.27rem rgb(225 163 45 / 88%); content: ''; }
.board-square--capture::after { position: absolute; z-index: 2; inset: 7%; border: clamp(0.16rem, 0.55vw, 0.34rem) solid rgb(103 46 30 / 56%); border-radius: 50%; content: ''; }
.move-dot { position: absolute; z-index: 2; width: 24%; aspect-ratio: 1; border-radius: 50%; background: rgb(69 47 34 / 45%); pointer-events: none; }
.chess-piece { position: relative; z-index: 3; display: grid; width: 100%; height: 100%; place-items: center; font-family: "Segoe UI Symbol", "Noto Sans Symbols 2", serif; font-size: clamp(2rem, 6.1vw, 5.5rem); line-height: 1; user-select: none; transition: transform 100ms ease; }
.board-square:hover .chess-piece { transform: translateY(-1.5%); }
.chess-piece--white { color: #fff9e8; text-shadow: 0 0.0625rem 0 #5f4937, 0 0.125rem 0.125rem rgb(39 28 18 / 56%); }
.chess-piece--black { color: #2d2824; text-shadow: 0 0.0625rem 0 rgb(255 255 255 / 26%), 0 0.125rem 0.125rem rgb(35 24 17 / 36%); }
.coordinate { position: absolute; z-index: 4; font-size: clamp(0.5rem, 0.9vw, 0.7rem); font-weight: 800; line-height: 1; opacity: 0.78; pointer-events: none; }
.coordinate--rank { top: 0.28rem; left: 0.3rem; }
.coordinate--file { right: 0.3rem; bottom: 0.26rem; }
.promotion-popover { position: absolute; z-index: 10; inset: 50% auto auto 50%; display: grid; width: min(21rem, 80%); padding: 0.9rem; gap: 0.6rem; color: var(--text-primary); border: 0.0625rem solid var(--border-subtle); border-radius: var(--radius-md); background: var(--surface-dialog); box-shadow: var(--shadow-md); text-align: center; transform: translate(-50%, -50%); }
.promotion-popover > span { color: var(--text-muted); font-size: 0.68rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
.promotion-popover > div { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.35rem; }
.promotion-popover > div button { aspect-ratio: 1; border: 0.0625rem solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--surface-panel); font-size: clamp(1.7rem, 4vw, 2.8rem); }
.promotion-popover > div button:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); }
.promotion-popover__cancel { color: var(--text-muted); background: transparent; font-size: 0.7rem; }
.piece-palette { display: flex; width: 100%; padding: 0.55rem 0.65rem; align-items: center; gap: 0.7rem; }
.piece-palette__label { display: grid; min-width: 8rem; }
.piece-palette__label strong { font-size: 0.74rem; }
.piece-palette__label span { color: var(--text-muted); font-size: 0.61rem; }
.piece-palette__pieces { display: flex; align-items: center; gap: 0.12rem; }
.piece-palette__pieces button { display: grid; width: 2rem; height: 2rem; place-items: center; border-radius: var(--radius-sm); background: transparent; font-family: "Segoe UI Symbol", serif; font-size: 1.4rem; }
.piece-palette__pieces button:hover, .piece-palette__pieces button.active { color: var(--accent); background: var(--accent-soft); }
.piece-palette__pieces .palette-colour { font-size: 1rem; }
.palette-colour--white { color: #c9b690; text-shadow: 0 0 0.0625rem #31291f; }
.palette-colour--black { color: #302a24; }
.palette-divider { width: 0.0625rem; height: 1.45rem; margin: 0 0.2rem; background: var(--border-subtle); }
.piece-palette__actions { display: flex; margin-left: auto; gap: 0.25rem; }
.piece-palette__actions .text-button { min-height: 2.1rem; padding: 0.35rem 0.55rem; font-size: 0.68rem; }
@media (max-width: 43.75rem) { .piece-palette { align-items: flex-start; flex-wrap: wrap; } .piece-palette__actions { width: 100%; margin-left: 0; justify-content: flex-end; } }
</style>
