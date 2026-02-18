export type Orientation = 'horizontal' | 'vertical';

export interface ShipPlacement {
  name: string;
  length: number;
  row: number;
  col: number;
  orientation: Orientation;
}

export interface ShotResult {
  row: number;
  col: number;
  result: 'hit' | 'miss';
  sunkShip?: string; // name of ship if this shot sunk it
}

export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

// Client → Server events
export interface ClientEvents {
  'create-game': (data: { mode: 'ai'; difficulty: AIDifficulty } | { mode: 'multiplayer' }, cb: (resp: { gameId: string; playerId: string }) => void) => void;
  'join-game': (data: { gameId: string }, cb: (resp: { success: boolean; playerId?: string; error?: string }) => void) => void;
  'place-ships': (data: { gameId: string; playerId: string; ships: ShipPlacement[] }, cb: (resp: { success: boolean; error?: string }) => void) => void;
  'fire-shot': (data: { gameId: string; playerId: string; row: number; col: number }, cb: (resp: { success: boolean; result?: ShotResult; error?: string }) => void) => void;
}

// Server → Client events
export interface ServerEvents {
  'shot-result': (data: ShotResult & { shooter: string }) => void;
  'opponent-shot': (data: ShotResult) => void;
  'turn-change': (data: { currentTurn: string }) => void;
  'game-over': (data: { winner: string }) => void;
  'opponent-ready': () => void;
  'opponent-disconnected': () => void;
  'opponent-reconnected': () => void;
}
