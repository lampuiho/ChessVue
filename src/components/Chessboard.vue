<script setup lang="ts">
import { computed, onBeforeUnmount, onBeforeUpdate, ref } from 'vue';
import { BoardOrientation, PieceKind, PlayerColour, type BoardId, type IBoardPosition, type IChessPiece, type IMove, type IMoveRaw } from '@/contracts';
import { genLegalMovesForPiece } from '@/utility/chess';
import AppIcon from './common/AppIcon.vue';
import ChessPiece from './common/ChessPiece.vue';
import { useModal, type IModalHandle } from '@/composables/ModalComposable';
import PromotionModal from './modals/PromotionModal.vue';

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
  moveAttempted: [move: IMoveRaw];
  chessPieceToggled: [boardId: BoardId, piece: IChessPiece];
  chessPieceDeleted: [boardId: BoardId];
  chessPieceMoved: [from: BoardId, to: BoardId];
  boardCleared: [];
  boardReset: [];
}>();
const modal = useModal();
let promotion: IModalHandle | undefined;
const selectedBoardId = ref<BoardId>();
let pendingPromotionMoves: readonly IMoveRaw[] = [];
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
const legalMoves = computed<IMoveRaw[]>(() => selectedBoardId.value === undefined ? [] : genLegalMovesForPiece(props.position, selectedBoardId.value, props.lastMove));
const fileNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

let _inputContext = [props.position, props.boardEdit, props.inputDisabled] as const;
// Clear the previous gesture before rendering a replacement board or input permission.
onBeforeUpdate(() => {
  const next = [props.position, props.boardEdit, props.inputDisabled] as const;
  if (next.every((value, index) => value === _inputContext[index])) return;
  _inputContext = next;
  _clearSelection();
});
onBeforeUnmount(_clearSelection);
function _isLegalTarget(boardId: BoardId): boolean {
  return legalMoves.value.some((move) => move.to === boardId);
}
function _clearSelection() {
  selectedBoardId.value = undefined;
  draggedBoardId.value = undefined;
  pendingPromotionMoves = [];
  const current = promotion;
  promotion = undefined;
  void current?.close();
}
function _selectSquare(boardId: BoardId) {
  if (props.inputDisabled) return;
  if (props.boardEdit) {
    emit('chessPieceToggled', boardId, { ...editPiece.value });
    return;
  }
  const piece = props.position.board[boardId];
  if (selectedBoardId.value === boardId) {
    _clearSelection();
    return;
  }
  if (selectedBoardId.value === undefined) {
    if (piece?.colour === props.position.sideToMove) selectedBoardId.value = boardId;
    return;
  }
  if (piece?.colour === props.position.sideToMove) {
    selectedBoardId.value = boardId;
    return;
  }
  _commitTarget(boardId);
}
function _commitTarget(boardId: BoardId) {
  if (props.inputDisabled) return;
  const matchingMoves = legalMoves.value.filter((move) => move.to === boardId);
  if (matchingMoves.length === 0) {
    _clearSelection();
    return;
  }
  if (matchingMoves.length > 1 && matchingMoves.some((move) => move.promotionPiece)) {
    pendingPromotionMoves = matchingMoves;
    const current = modal.open(PromotionModal, { moves: matchingMoves, colour: props.position.sideToMove, onSelected: _choosePromotion }, () => {
      if (promotion === current) _clearSelection();
    });
    promotion = current;
    return;
  }
  _emitMove(matchingMoves[0]!);
}
function _emitMove(rawMove: IMoveRaw) {
  if (props.inputDisabled || props.boardEdit) return;
  const { from, to, promotionPiece } = rawMove;
  emit('moveAttempted', promotionPiece === undefined ? { from, to } : { from, to, promotionPiece });
  _clearSelection();
}
function _choosePromotion(move: IMoveRaw) {
  if (pendingPromotionMoves.includes(move)) _emitMove(move);
}
function _onDragStart(boardId: BoardId, event: DragEvent) {
  if (props.inputDisabled || !props.position.board[boardId]) {
    event.preventDefault();
    return;
  }
  draggedBoardId.value = boardId;
  selectedBoardId.value = boardId;
  event.dataTransfer?.setData('text/plain', String(boardId));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}
function _onDrop(boardId: BoardId) {
  const from = draggedBoardId.value;
  draggedBoardId.value = undefined;
  if (from === undefined || props.inputDisabled) return;
  if (props.boardEdit) emit('chessPieceMoved', from, boardId);
  else _commitTarget(boardId);
}
function _onContextMenu(boardId: BoardId) {
  if (props.boardEdit) emit('chessPieceDeleted', boardId);
}
function _isLastMoveSquare(boardId: BoardId): boolean {
  return !!props.highlightLastMove && (props.lastMove?.from === boardId || props.lastMove?.to === boardId);
}
function _showRank(index: number): boolean {
  return props.showCoordinates && index % 8 === 0;
}
function _showFile(index: number): boolean {
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
          :disabled="inputDisabled"
          :aria-pressed="selectedBoardId === boardId"
          :class="{
            'board-square--light': (Math.floor(boardId / 8) + boardId % 8) % 2 === 1,
            'board-square--dark': (Math.floor(boardId / 8) + boardId % 8) % 2 === 0,
            'board-square--selected': selectedBoardId === boardId,
            'board-square--target': _isLegalTarget(boardId),
            'board-square--capture': _isLegalTarget(boardId) && !!position.board[boardId],
            'board-square--last': _isLastMoveSquare(boardId),
          }"
          :aria-label="`${fileNames[boardId % 8]}${Math.floor(boardId / 8) + 1}${position.board[boardId] ? ` ${position.board[boardId]?.colour} ${position.board[boardId]?.kind}` : ''}`"
          @click="_selectSquare(boardId)"
          @contextmenu.prevent="_onContextMenu(boardId)"
          @dragover.prevent
          @drop.prevent="_onDrop(boardId)"
        >
          <span v-if="_showRank(index)" class="coordinate coordinate--rank">{{ Math.floor(boardId / 8) + 1 }}</span>
          <span v-if="_showFile(index)" class="coordinate coordinate--file">{{ fileNames[boardId % 8] }}</span>
          <span v-if="position.board[boardId]" class="chess-piece" :draggable="!inputDisabled" @dragstart.stop="_onDragStart(boardId, $event)"><ChessPiece v-bind="position.board[boardId]!" /></span>
          <span v-if="_isLegalTarget(boardId) && !position.board[boardId]" class="move-dot"></span>
        </button>
      </div>
    </div>
    <div v-if="boardEdit" class="piece-palette surface">
      <div class="piece-palette__label"><strong>Position editor</strong><span>Choose a piece, then click a square. Right-click removes.</span></div>
      <div class="piece-palette__pieces">
        <button v-for="colour in [PlayerColour.White, PlayerColour.Black]" :key="colour" class="palette-colour" :aria-label="`${colour} pieces`" :aria-pressed="editPiece.colour === colour" @click="editPiece.colour = colour"><ChessPiece :kind="PieceKind.Pawn" :colour="colour" /></button>
        <span class="palette-divider"></span>
        <button v-for="kind in pieceKinds" :key="kind" :class="{ active: editPiece.kind === kind }" :aria-label="kind" @click="editPiece.kind = kind"><ChessPiece :kind="kind" :colour="editPiece.colour" /></button>
      </div>
      <div class="piece-palette__actions"><button class="text-button text-button--ghost text-button--palette" @click="emit('boardCleared')"><AppIcon name="trash" />Clear</button><button class="text-button text-button--palette" @click="emit('boardReset')"><AppIcon name="rotate" />Reset</button></div>
    </div>
  </div>
</template>

