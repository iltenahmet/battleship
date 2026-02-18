import { create } from 'zustand';
import { socket } from '../socket';
import type { ShipPlacement, ShotResult, AIDifficulty } from '../../../shared/types';

export type Orientation = 'horizontal' | 'vertical';

export interface ShipDef {
  name: string;
  length: number;
}

export const SHIPS: ShipDef[] = [
  { name: 'Carrier', length: 5 },
  { name: 'Battleship', length: 4 },
  { name: 'Cruiser', length: 3 },
  { name: 'Submarine', length: 3 },
  { name: 'Destroyer', length: 2 },
];

export interface PlacedShip {
  name: string;
  length: number;
  row: number;
  col: number;
  orientation: Orientation;
}

export type Phase = 'menu' | 'placement' | 'waiting' | 'firing' | 'gameOver';
export type GameMode = 'ai' | 'multiplayer';

interface GameState {
  phase: Phase;
  gameMode: GameMode | null;
  gameId: string | null;
  playerId: string | null;
  isMyTurn: boolean;
  winner: string | null;
  difficulty: AIDifficulty;

  // Placement
  currentShipIndex: number;
  orientation: Orientation;
  placedShips: PlacedShip[];
  hoveredCell: { row: number; col: number } | null;

  // Firing
  myShots: ShotResult[];       // shots I fired at opponent
  opponentShots: ShotResult[]; // shots opponent fired at me
  lastSunkShip: string | null;
  notification: string | null;

  // Actions
  setPhase: (phase: Phase) => void;
  setGameMode: (mode: GameMode) => void;
  setDifficulty: (d: AIDifficulty) => void;
  setHoveredCell: (cell: { row: number; col: number } | null) => void;
  toggleOrientation: () => void;
  placeShip: (row: number, col: number) => boolean;
  resetPlacement: () => void;
  goToMenu: () => void;
  startGame: () => void;
  confirmFleet: () => void;
  fire: (row: number, col: number) => void;
  setNotification: (msg: string | null) => void;
}

function isValidPlacement(
  row: number, col: number, length: number, orientation: Orientation, placedShips: PlacedShip[],
): boolean {
  if (orientation === 'horizontal' && col + length > 10) return false;
  if (orientation === 'vertical' && row + length > 10) return false;

  const newCells: string[] = [];
  for (let i = 0; i < length; i++) {
    const r = orientation === 'vertical' ? row + i : row;
    const c = orientation === 'horizontal' ? col + i : col;
    newCells.push(`${r},${c}`);
  }

  const occupied = new Set<string>();
  for (const ship of placedShips) {
    for (let i = 0; i < ship.length; i++) {
      const r = ship.orientation === 'vertical' ? ship.row + i : ship.row;
      const c = ship.orientation === 'horizontal' ? ship.col + i : ship.col;
      occupied.add(`${r},${c}`);
    }
  }

  return newCells.every((cell) => !occupied.has(cell));
}

export { isValidPlacement };

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'menu',
  gameMode: null,
  gameId: null,
  playerId: null,
  isMyTurn: false,
  winner: null,
  difficulty: 'medium',
  currentShipIndex: 0,
  orientation: 'horizontal',
  placedShips: [],
  hoveredCell: null,
  myShots: [],
  opponentShots: [],
  lastSunkShip: null,
  notification: null,

  setPhase: (phase) => set({ phase }),
  setGameMode: (mode) => set({ gameMode: mode }),
  setDifficulty: (d) => set({ difficulty: d }),
  setHoveredCell: (cell) => set({ hoveredCell: cell }),
  setNotification: (msg) => set({ notification: msg }),

  toggleOrientation: () =>
    set((s) => ({ orientation: s.orientation === 'horizontal' ? 'vertical' : 'horizontal' })),

  placeShip: (row, col) => {
    const { currentShipIndex, orientation, placedShips } = get();
    if (currentShipIndex >= SHIPS.length) return false;
    const shipDef = SHIPS[currentShipIndex];
    if (!isValidPlacement(row, col, shipDef.length, orientation, placedShips)) return false;

    set({
      placedShips: [...placedShips, { name: shipDef.name, length: shipDef.length, row, col, orientation }],
      currentShipIndex: currentShipIndex + 1,
    });
    return true;
  },

  resetPlacement: () => set({ placedShips: [], currentShipIndex: 0, orientation: 'horizontal' }),

  goToMenu: () => {
    socket.disconnect();
    set({
      phase: 'menu', gameMode: null, gameId: null, playerId: null,
      placedShips: [], currentShipIndex: 0, orientation: 'horizontal',
      hoveredCell: null, myShots: [], opponentShots: [], isMyTurn: false,
      winner: null, lastSunkShip: null, notification: null,
    });
  },

  startGame: () => {
    const { gameMode, difficulty } = get();
    if (!socket.connected) socket.connect();

    const mode = gameMode!;
    const createData = mode === 'ai' ? { mode, difficulty } as const : { mode } as const;

    socket.emit('create-game', createData, (resp: { gameId: string; playerId: string }) => {
      set({ gameId: resp.gameId, playerId: resp.playerId, phase: 'placement' });
    });
  },

  confirmFleet: () => {
    const { gameId, playerId, placedShips } = get();
    const ships: ShipPlacement[] = placedShips.map((s) => ({
      name: s.name, length: s.length, row: s.row, col: s.col, orientation: s.orientation,
    }));

    socket.emit('place-ships', { gameId, playerId, ships }, (resp: { success: boolean; error?: string }) => {
      if (!resp.success) {
        set({ notification: resp.error || 'Placement failed' });
        return;
      }
      // For AI, game-start will fire immediately. For multiplayer, we wait.
      set({ phase: 'waiting', notification: 'Waiting for opponent...' });
    });
  },

  fire: (row, col) => {
    const { gameId, playerId, isMyTurn, myShots } = get();
    if (!isMyTurn) return;
    // Check if already fired here
    if (myShots.some((s) => s.row === row && s.col === col)) return;

    socket.emit('fire-shot', { gameId, playerId, row, col },
      (resp: { success: boolean; result?: ShotResult; error?: string }) => {
        if (!resp.success) return;
        const result = resp.result!;
        set((s) => ({
          myShots: [...s.myShots, result],
          isMyTurn: false,
          notification: result.sunkShip
            ? `You sunk their ${result.sunkShip}!`
            : result.result === 'hit' ? 'Hit!' : 'Miss',
        }));
      }
    );
  },
}));

// Socket event listeners (outside store, update store directly)
socket.on('game-start', (data: { currentTurn: string }) => {
  const state = useGameStore.getState();
  useGameStore.setState({
    phase: 'firing',
    isMyTurn: data.currentTurn === state.playerId,
    notification: data.currentTurn === state.playerId ? 'Your turn — fire!' : "Opponent's turn",
  });
});

socket.on('opponent-shot', (data: ShotResult) => {
  const state = useGameStore.getState();
  const msg = data.sunkShip
    ? `They sunk your ${data.sunkShip}!`
    : data.result === 'hit' ? 'You were hit!' : 'They missed';
  useGameStore.setState({
    opponentShots: [...state.opponentShots, data],
    notification: msg,
  });
});

socket.on('turn-change', (data: { currentTurn: string }) => {
  const state = useGameStore.getState();
  const myTurn = data.currentTurn === state.playerId;
  useGameStore.setState({
    isMyTurn: myTurn,
    notification: myTurn ? 'Your turn — fire!' : "Opponent's turn",
  });
});

socket.on('game-over', (data: { winner: string }) => {
  const state = useGameStore.getState();
  useGameStore.setState({
    phase: 'gameOver',
    winner: data.winner === state.playerId ? 'you' : 'opponent',
    notification: data.winner === state.playerId ? 'You win!' : 'You lose!',
  });
});
