import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      difficulty TEXT,
      winner TEXT,
      state JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS game_moves (
      id SERIAL PRIMARY KEY,
      game_id TEXT REFERENCES games(id),
      player_id TEXT NOT NULL,
      move_type TEXT NOT NULL,
      row INTEGER,
      col INTEGER,
      result TEXT,
      sunk_ship TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS game_players (
      game_id TEXT REFERENCES games(id),
      player_id TEXT NOT NULL,
      player_number INTEGER NOT NULL,
      ships JSONB,
      PRIMARY KEY (game_id, player_id)
    );
  `);

  // Add state column if it doesn't exist (for existing DBs)
  await pool.query(`
    ALTER TABLE games ADD COLUMN IF NOT EXISTS state JSONB;
  `);

  console.log('Database initialized');
}

export async function saveGame(id: string, mode: string, difficulty?: string) {
  await pool.query(
    'INSERT INTO games (id, mode, difficulty) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
    [id, mode, difficulty || null]
  );
}

export async function saveGameState(gameId: string, state: object) {
  await pool.query(
    'UPDATE games SET state = $2 WHERE id = $1',
    [gameId, JSON.stringify(state)]
  );
}

export async function loadGameState(gameId: string): Promise<object | null> {
  const result = await pool.query('SELECT state FROM games WHERE id = $1', [gameId]);
  if (result.rows.length === 0 || !result.rows[0].state) return null;
  return result.rows[0].state;
}

export async function findActiveGameForPlayer(playerId: string): Promise<{ gameId: string; state: object } | null> {
  const result = await pool.query(
    `SELECT g.id, g.state FROM games g
     JOIN game_players gp ON g.id = gp.game_id
     WHERE gp.player_id = $1 AND g.finished_at IS NULL AND g.state IS NOT NULL
     ORDER BY g.created_at DESC LIMIT 1`,
    [playerId]
  );
  if (result.rows.length === 0 || !result.rows[0].state) return null;
  return { gameId: result.rows[0].id, state: result.rows[0].state };
}

export async function savePlayer(gameId: string, playerId: string, playerNumber: number, ships?: object) {
  await pool.query(
    'INSERT INTO game_players (game_id, player_id, player_number, ships) VALUES ($1, $2, $3, $4) ON CONFLICT (game_id, player_id) DO UPDATE SET ships = $4',
    [gameId, playerId, playerNumber, ships ? JSON.stringify(ships) : null]
  );
}

export async function saveMove(gameId: string, playerId: string, moveType: string, row?: number, col?: number, result?: string, sunkShip?: string) {
  await pool.query(
    'INSERT INTO game_moves (game_id, player_id, move_type, row, col, result, sunk_ship) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [gameId, playerId, moveType, row ?? null, col ?? null, result ?? null, sunkShip ?? null]
  );
}

export async function finishGame(gameId: string, winner: string) {
  await pool.query(
    'UPDATE games SET winner = $2, finished_at = NOW() WHERE id = $1',
    [gameId, winner]
  );
}

export default pool;
