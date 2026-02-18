import { create } from 'zustand';

export type Orientation = 'horizontal' | 'vertical';

export interface ShipDef {
  name: string;
  length: number;
  model: string;
}

export const SHIPS: ShipDef[] = [
  { name: 'Carrier', length: 5, model: '/models/ship-large.glb' },
  { name: 'Battleship', length: 4, model: '/models/ship-cargo-a.glb' },
  { name: 'Cruiser', length: 3, model: '/models/ship-ocean-liner-small.glb' },
  { name: 'Submarine', length: 3, model: '/models/ship-small.glb' },
  { name: 'Destroyer', length: 2, model: '/models/boat-speed-a.glb' },
];

export interface PlacedShip {
  name: string;
  length: number;
  row: number;
  col: number;
  orientation: Orientation;
}

export type Phase = 'menu' | 'placement' | 'firing' | 'gameOver';
export type GameMode = 'ai' | 'multiplayer';

interface GameState {
  phase: Phase;
  gameMode: GameMode | null;
  // Placement
  currentShipIndex: number;
  orientation: Orientation;
  placedShips: PlacedShip[];
  hoveredCell: { row: number; col: number } | null;
  // Actions
  setPhase: (phase: Phase) => void;
  setGameMode: (mode: GameMode) => void;
  setHoveredCell: (cell: { row: number; col: number } | null) => void;
  toggleOrientation: () => void;
  placeShip: (row: number, col: number) => boolean;
  resetPlacement: () => void;
  goToMenu: () => void;
}

function isValidPlacement(
  row: number,
  col: number,
  length: number,
  orientation: Orientation,
  placedShips: PlacedShip[],
): boolean {
  // Check bounds
  if (orientation === 'horizontal' && col + length > 10) return false;
  if (orientation === 'vertical' && row + length > 10) return false;

  // Check overlap
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

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'menu',
  gameMode: null,
  currentShipIndex: 0,
  orientation: 'horizontal',
  placedShips: [],
  hoveredCell: null,

  setPhase: (phase) => set({ phase }),
  setGameMode: (mode) => set({ gameMode: mode }),
  setHoveredCell: (cell) => set({ hoveredCell: cell }),
  toggleOrientation: () =>
    set((s) => ({
      orientation: s.orientation === 'horizontal' ? 'vertical' : 'horizontal',
    })),

  placeShip: (row, col) => {
    const { currentShipIndex, orientation, placedShips } = get();
    if (currentShipIndex >= SHIPS.length) return false;

    const shipDef = SHIPS[currentShipIndex];
    if (!isValidPlacement(row, col, shipDef.length, orientation, placedShips)) {
      return false;
    }

    set({
      placedShips: [
        ...placedShips,
        { name: shipDef.name, length: shipDef.length, row, col, orientation },
      ],
      currentShipIndex: currentShipIndex + 1,
    });
    return true;
  },

  resetPlacement: () =>
    set({ placedShips: [], currentShipIndex: 0, orientation: 'horizontal' }),

  goToMenu: () =>
    set({
      phase: 'menu',
      gameMode: null,
      placedShips: [],
      currentShipIndex: 0,
      orientation: 'horizontal',
      hoveredCell: null,
    }),
}));

export { isValidPlacement };
