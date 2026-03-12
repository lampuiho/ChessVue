import { defineStore } from "pinia";

import { MovePermission } from '@/models/enums/MovePermission';
import { ChessPiece } from '@/models/enums/ChessPiece';
import type IChessPiece from '@/models/interfaces/IChessPiece';
import type IGame from '@/models/interfaces/IGame';
import { ref } from "vue";

const useGameStore = defineStore('game', ()=>{
    const games = ref([] as IGame[]);
    function createStandardGamePieces(): (IChessPiece | null)[] {
    const cells: (IChessPiece | null)[] = Array(64).fill(null);

    // Black pieces (side: false, on top)
    // Row 0: Back rank
    cells[0] = { chess: ChessPiece.ROOK, isWhite: false };
    cells[1] = { chess: ChessPiece.KNIGHT, isWhite: false };
    cells[2] = { chess: ChessPiece.BISHOP, isWhite: false };
    cells[3] = { chess: ChessPiece.QUEEN, isWhite: false };
    cells[4] = { chess: ChessPiece.KING, isWhite: false };
    cells[5] = { chess: ChessPiece.BISHOP, isWhite: false };
    cells[6] = { chess: ChessPiece.KNIGHT, isWhite: false };
    cells[7] = { chess: ChessPiece.ROOK, isWhite: false };

    // Row 1: Pawns
    for (let i = 8; i < 16; i++) {
        cells[i] = { chess: ChessPiece.PAWN, isWhite: false };
    }

    // White pieces (side: true, on bottom)
    // Row 6: Pawns
    for (let i = 48; i < 56; i++) {
        cells[i] = { chess: ChessPiece.PAWN, isWhite: true };
    }

    // Row 7: Back rank
    cells[56] = { chess: ChessPiece.ROOK, isWhite: true };
    cells[57] = { chess: ChessPiece.KNIGHT, isWhite: true };
    cells[58] = { chess: ChessPiece.BISHOP, isWhite: true };
    cells[59] = { chess: ChessPiece.QUEEN, isWhite: true };
    cells[60] = { chess: ChessPiece.KING, isWhite: true };
    cells[61] = { chess: ChessPiece.BISHOP, isWhite: true };
    cells[62] = { chess: ChessPiece.KNIGHT, isWhite: true };
    cells[63] = { chess: ChessPiece.ROOK, isWhite: true };

    return cells;
    }
    function createNewStandardGame() {
        const initialCells = createStandardGamePieces();
        const newGame: IGame = {
            chessBoardState: {
                cells: initialCells,
                turn: MovePermission.WHITE,
            },
            playerWhite: {

            },
            playerBlack: {

            }
        };
        games.value.push(newGame);
    }
    return {
        games,
        createNewStandardGame,
    }
});