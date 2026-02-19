import { ShipPlacement, ShotResult, Orientation, AIDifficulty } from '../../shared/types';

const BOARD_SIZE = 10;

interface ShipState {
  name: string;
  length: number;
  cells: { row: number; col: number }[];
  hits: number;
}

interface PlayerState {
  ships: ShipState[];
  board: ('empty' | 'ship')[][];      // own board
  shots: ('hit' | 'miss')[][];        // shots fired at opponent
  ready: boolean;
}

export interface Game {
  id: string;
  mode: 'ai' | 'multiplayer';
  difficulty?: AIDifficulty;
  players: { [playerId: string]: PlayerState };
  playerOrder: string[];  // [player1Id, player2Id]
  currentTurn: string;    // playerId whose turn it is
  phase: 'placement' | 'firing' | 'over';
  winner?: string;
}

function createEmptyBoard<T>(fill: T): T[][] {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => fill)
  );
}

function createPlayerState(): PlayerState {
  return {
    ships: [],
    board: createEmptyBoard('empty' as 'empty' | 'ship'),
    shots: createEmptyBoard(null as unknown as 'hit' | 'miss'),
    ready: false,
  };
}

export function createGame(id: string, mode: 'ai' | 'multiplayer', difficulty?: AIDifficulty): Game {
  return {
    id,
    mode,
    difficulty,
    players: {},
    playerOrder: [],
    currentTurn: '',
    phase: 'placement',
  };
}

export function addPlayer(game: Game, playerId: string): boolean {
  if (game.playerOrder.length >= 2) return false;
  game.players[playerId] = createPlayerState();
  game.playerOrder.push(playerId);
  return true;
}

export function validatePlacement(ships: ShipPlacement[]): string | null {
  const expected = [
    { name: 'Carrier', length: 5 },
    { name: 'Battleship', length: 4 },
    { name: 'Cruiser', length: 3 },
    { name: 'Submarine', length: 3 },
    { name: 'Destroyer', length: 2 },
  ];

  if (ships.length !== 5) return 'Must place exactly 5 ships';

  for (const exp of expected) {
    const found = ships.find((s) => s.name === exp.name && s.length === exp.length);
    if (!found) return `Missing or invalid ship: ${exp.name}`;
  }

  const occupied = new Set<string>();
  for (const ship of ships) {
    for (let i = 0; i < ship.length; i++) {
      const r = ship.orientation === 'vertical' ? ship.row + i : ship.row;
      const c = ship.orientation === 'horizontal' ? ship.col + i : ship.col;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
        return `${ship.name} is out of bounds`;
      }
      const key = `${r},${c}`;
      if (occupied.has(key)) return `${ship.name} overlaps another ship`;
      occupied.add(key);
    }
  }

  return null;
}

export function placeShips(game: Game, playerId: string, ships: ShipPlacement[]): string | null {
  const player = game.players[playerId];
  if (!player) return 'Player not found';
  if (player.ready) return 'Ships already placed';

  const error = validatePlacement(ships);
  if (error) return error;

  player.ships = ships.map((s) => {
    const cells: { row: number; col: number }[] = [];
    for (let i = 0; i < s.length; i++) {
      const r = s.orientation === 'vertical' ? s.row + i : s.row;
      const c = s.orientation === 'horizontal' ? s.col + i : s.col;
      cells.push({ row: r, col: c });
    }
    return { name: s.name, length: s.length, cells, hits: 0 };
  });

  // Mark board
  for (const ship of player.ships) {
    for (const cell of ship.cells) {
      player.board[cell.row][cell.col] = 'ship';
    }
  }

  player.ready = true;
  return null;
}

export function allPlayersReady(game: Game): boolean {
  return game.playerOrder.length === 2 &&
    game.playerOrder.every((id) => game.players[id].ready);
}

export function startFiring(game: Game): void {
  game.phase = 'firing';
  game.currentTurn = game.playerOrder[0];
}

export function fireShot(game: Game, shooterId: string, row: number, col: number): ShotResult | string {
  if (game.phase !== 'firing') return 'Game not in firing phase';
  if (game.currentTurn !== shooterId) return 'Not your turn';
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return 'Out of bounds';

  const shooter = game.players[shooterId];
  if (shooter.shots[row][col]) return 'Already fired at this cell';

  // Find opponent
  const opponentId = game.playerOrder.find((id) => id !== shooterId)!;
  const opponent = game.players[opponentId];

  const isHit = opponent.board[row][col] === 'ship';
  let sunkShip: string | undefined;

  if (isHit) {
    shooter.shots[row][col] = 'hit';
    // Find which ship was hit and increment hits
    for (const ship of opponent.ships) {
      if (ship.cells.some((c) => c.row === row && c.col === col)) {
        ship.hits++;
        if (ship.hits === ship.length) {
          sunkShip = ship.name;
        }
        break;
      }
    }

    // Check win
    const allSunk = opponent.ships.every((s) => s.hits === s.length);
    if (allSunk) {
      game.phase = 'over';
      game.winner = shooterId;
    }
  } else {
    shooter.shots[row][col] = 'miss';
  }

  // Switch turns (unless game is over)
  if (game.phase !== 'over') {
    game.currentTurn = opponentId;
  }

  return { row, col, result: isHit ? 'hit' : 'miss', sunkShip };
}

// --- AI Logic ---

function getAvailableCells(shots: ('hit' | 'miss')[][]): { row: number; col: number }[] {
  const cells: { row: number; col: number }[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!shots[r][c]) cells.push({ row: r, col: c });
    }
  }
  return cells;
}

function getAdjacentCells(row: number, col: number, shots: ('hit' | 'miss')[][]): { row: number; col: number }[] {
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const result: { row: number; col: number }[] = [];
  for (const [dr, dc] of dirs) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && !shots[r][c]) {
      result.push({ row: r, col: c });
    }
  }
  return result;
}

function getUnsunkHits(player: PlayerState, opponent: PlayerState): { row: number; col: number }[] {
  const hits: { row: number; col: number }[] = [];
  const sunkCells = new Set<string>();

  for (const ship of opponent.ships) {
    if (ship.hits === ship.length) {
      for (const c of ship.cells) sunkCells.add(`${c.row},${c.col}`);
    }
  }

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (player.shots[r][c] === 'hit' && !sunkCells.has(`${r},${c}`)) {
        hits.push({ row: r, col: c });
      }
    }
  }
  return hits;
}

function aiEasy(player: PlayerState): { row: number; col: number } {
  const available = getAvailableCells(player.shots);
  return available[Math.floor(Math.random() * available.length)];
}

function aiMedium(player: PlayerState, opponent: PlayerState): { row: number; col: number } {
  const unsunkHits = getUnsunkHits(player, opponent);

  if (unsunkHits.length > 0) {
    // Target mode: try adjacent cells of unsunk hits
    for (const hit of unsunkHits) {
      const adj = getAdjacentCells(hit.row, hit.col, player.shots);
      if (adj.length > 0) {
        return adj[Math.floor(Math.random() * adj.length)];
      }
    }
  }

  // Hunt mode: random
  return aiEasy(player);
}

function aiHard(player: PlayerState, opponent: PlayerState): { row: number; col: number } {
  const unsunkHits = getUnsunkHits(player, opponent);

  if (unsunkHits.length > 0) {
    for (const hit of unsunkHits) {
      const adj = getAdjacentCells(hit.row, hit.col, player.shots);
      if (adj.length > 0) {
        return adj[Math.floor(Math.random() * adj.length)];
      }
    }
  }

  // Hunt mode with parity (checkerboard)
  const available = getAvailableCells(player.shots).filter(
    (c) => (c.row + c.col) % 2 === 0
  );
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }
  return aiEasy(player);
}

function aiExpert(player: PlayerState, opponent: PlayerState): { row: number; col: number } {
  const unsunkHits = getUnsunkHits(player, opponent);

  if (unsunkHits.length > 0) {
    for (const hit of unsunkHits) {
      const adj = getAdjacentCells(hit.row, hit.col, player.shots);
      if (adj.length > 0) {
        return adj[Math.floor(Math.random() * adj.length)];
      }
    }
  }

  // Probability density
  const remainingShips = opponent.ships
    .filter((s) => s.hits < s.length)
    .map((s) => s.length);

  const density: number[][] = createEmptyBoard(0);

  for (const shipLen of remainingShips) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        // Try horizontal
        if (c + shipLen <= BOARD_SIZE) {
          let valid = true;
          for (let i = 0; i < shipLen; i++) {
            if (player.shots[r][c + i] === 'miss') { valid = false; break; }
          }
          if (valid) {
            for (let i = 0; i < shipLen; i++) {
              if (!player.shots[r][c + i]) density[r][c + i]++;
            }
          }
        }
        // Try vertical
        if (r + shipLen <= BOARD_SIZE) {
          let valid = true;
          for (let i = 0; i < shipLen; i++) {
            if (player.shots[r + i][c] === 'miss') { valid = false; break; }
          }
          if (valid) {
            for (let i = 0; i < shipLen; i++) {
              if (!player.shots[r + i][c]) density[r + i][c]++;
            }
          }
        }
      }
    }
  }

  // Find max density among unfired cells
  let best = { row: 0, col: 0 };
  let bestVal = -1;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!player.shots[r][c] && density[r][c] > bestVal) {
        bestVal = density[r][c];
        best = { row: r, col: c };
      }
    }
  }
  return best;
}

export function aiChooseShot(game: Game): { row: number; col: number } {
  const aiId = game.playerOrder[1];
  const humanId = game.playerOrder[0];
  const aiPlayer = game.players[aiId];
  const humanPlayer = game.players[humanId];

  switch (game.difficulty) {
    case 'easy': return aiEasy(aiPlayer);
    case 'hard': return aiHard(aiPlayer, humanPlayer);
    case 'expert': return aiExpert(aiPlayer, humanPlayer);
    case 'medium':
    default: return aiMedium(aiPlayer, humanPlayer);
  }
}

export function aiPlaceShips(): ShipPlacement[] {
  const ships = [
    { name: 'Carrier', length: 5 },
    { name: 'Battleship', length: 4 },
    { name: 'Cruiser', length: 3 },
    { name: 'Submarine', length: 3 },
    { name: 'Destroyer', length: 2 },
  ];

  const placed: ShipPlacement[] = [];
  const occupied = new Set<string>();

  for (const ship of ships) {
    let attempts = 0;
    while (attempts < 1000) {
      const orientation: Orientation = Math.random() < 0.5 ? 'horizontal' : 'vertical';
      const maxRow = orientation === 'vertical' ? BOARD_SIZE - ship.length : BOARD_SIZE - 1;
      const maxCol = orientation === 'horizontal' ? BOARD_SIZE - ship.length : BOARD_SIZE - 1;
      const row = Math.floor(Math.random() * (maxRow + 1));
      const col = Math.floor(Math.random() * (maxCol + 1));

      const cells: string[] = [];
      let valid = true;
      for (let i = 0; i < ship.length; i++) {
        const r = orientation === 'vertical' ? row + i : row;
        const c = orientation === 'horizontal' ? col + i : col;
        const key = `${r},${c}`;
        if (occupied.has(key)) { valid = false; break; }
        cells.push(key);
      }

      if (valid) {
        cells.forEach((k) => occupied.add(k));
        placed.push({ name: ship.name, length: ship.length, row, col, orientation });
        break;
      }
      attempts++;
    }
  }

  return placed;
}

// Build client-safe state for a specific player (never leaks opponent ship positions)
export function getClientState(game: Game, playerId: string) {
  const player = game.players[playerId];
  if (!player) return null;

  const opponentId = game.playerOrder.find((id) => id !== playerId);

  // My shots (what I fired at opponent)
  const myShots: ShotResult[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (player.shots[r][c]) {
        const shot: ShotResult = { row: r, col: c, result: player.shots[r][c] };
        // Check if this shot sunk a ship
        if (opponentId && game.players[opponentId]) {
          for (const ship of game.players[opponentId].ships) {
            if (ship.hits === ship.length && ship.cells.some(cell => cell.row === r && cell.col === c)) {
              shot.sunkShip = ship.name;
            }
          }
        }
        myShots.push(shot);
      }
    }
  }

  // Opponent's shots on me
  const opponentShots: ShotResult[] = [];
  if (opponentId && game.players[opponentId]) {
    const opp = game.players[opponentId];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (opp.shots[r][c]) {
          const shot: ShotResult = { row: r, col: c, result: opp.shots[r][c] };
          for (const ship of player.ships) {
            if (ship.hits === ship.length && ship.cells.some(cell => cell.row === r && cell.col === c)) {
              shot.sunkShip = ship.name;
            }
          }
          opponentShots.push(shot);
        }
      }
    }
  }

  // My ships as placements (for rendering on my board)
  const myShips = player.ships.map(s => ({
    name: s.name,
    length: s.length,
    row: s.cells[0].row,
    col: s.cells[0].col,
    orientation: (s.cells.length > 1 && s.cells[1].row !== s.cells[0].row ? 'vertical' : 'horizontal') as Orientation,
  }));

  return {
    gameId: game.id,
    playerId,
    phase: game.phase,
    mode: game.mode,
    isMyTurn: game.currentTurn === playerId,
    shipsReady: player.ready,
    myShips,
    myShots,
    opponentShots,
    winner: game.winner ? (game.winner === playerId ? 'you' : 'opponent') : null,
  };
}
