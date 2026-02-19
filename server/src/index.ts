import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  Game, createGame, addPlayer, placeShips, allPlayersReady,
  startFiring, fireShot, aiChooseShot, aiPlaceShips, getClientState,
} from './game';
import { ShotResult } from '../../shared/types';
import { initDb, saveGame, saveGameState, loadGameState, findActiveGameForPlayer, savePlayer, saveMove, finishGame } from './db';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

const games = new Map<string, Game>();
const playerToSocket = new Map<string, string>();
const socketToPlayer = new Map<string, string>();
const playerToGame = new Map<string, string>(); // playerId -> gameId

// Helper: persist game state to DB (fire and forget)
async function persistGame(game: Game) {
  try { await saveGameState(game.id, game); } catch (e) { console.error('DB persist error:', e); }
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/games', async (_req, res) => {
  try {
    const { default: pool } = await import('./db');
    const result = await pool.query(
      'SELECT id, mode, difficulty, winner, created_at, finished_at FROM games ORDER BY created_at DESC LIMIT 50'
    );
    res.json(result.rows);
  } catch { res.json([]); }
});

app.get('/api/games/:id/moves', async (req, res) => {
  try {
    const { default: pool } = await import('./db');
    const result = await pool.query(
      'SELECT * FROM game_moves WHERE game_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch { res.json([]); }
});

if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../../client/dist');
  app.use(express.static(clientPath));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  // Reconnect: client sends stored playerId/gameId, server restores state
  socket.on('reconnect-game', async (data: { playerId: string; gameId: string }, cb) => {
    const { playerId, gameId } = data;

    // Try in-memory first
    let game = games.get(gameId);

    // If not in memory, try loading from DB
    if (!game && process.env.DATABASE_URL) {
      try {
        const saved = await loadGameState(gameId);
        if (saved) {
          game = saved as Game;
          games.set(gameId, game);
        }
      } catch (e) { console.error('DB load error:', e); }
    }

    if (!game || !game.players[playerId]) {
      return cb({ success: false, error: 'Game not found' });
    }

    // Re-register socket mappings
    playerToSocket.set(playerId, socket.id);
    socketToPlayer.set(socket.id, playerId);
    playerToGame.set(playerId, gameId);
    socket.join(gameId);

    const clientState = getClientState(game, playerId);
    cb({ success: true, state: clientState });

    // Notify opponent of reconnect
    const opponentId = game.playerOrder.find((id) => id !== playerId);
    if (opponentId && opponentId !== 'ai') {
      const oppSocketId = playerToSocket.get(opponentId);
      if (oppSocketId) io.to(oppSocketId).emit('opponent-reconnected');
    }
  });

  socket.on('create-game', async (data, cb) => {
    const gameId = uuidv4().slice(0, 8).toUpperCase();
    const playerId = uuidv4();
    const game = createGame(gameId, data.mode, data.mode === 'ai' ? data.difficulty : undefined);
    addPlayer(game, playerId);

    if (data.mode === 'ai') {
      addPlayer(game, 'ai');
      const aiShips = aiPlaceShips();
      placeShips(game, 'ai', aiShips);
    }

    games.set(gameId, game);
    playerToSocket.set(playerId, socket.id);
    socketToPlayer.set(socket.id, playerId);
    playerToGame.set(playerId, gameId);
    socket.join(gameId);

    try {
      await saveGame(gameId, data.mode, data.mode === 'ai' ? data.difficulty : undefined);
      await savePlayer(gameId, playerId, 1);
      if (data.mode === 'ai') await savePlayer(gameId, 'ai', 2);
      await persistGame(game);
    } catch (e) { console.error('DB save error:', e); }

    cb({ gameId, playerId });
  });

  socket.on('join-game', async (data, cb) => {
    const game = games.get(data.gameId);
    if (!game) return cb({ success: false, error: 'Game not found' });
    if (game.playerOrder.length >= 2) return cb({ success: false, error: 'Game is full' });

    const playerId = uuidv4();
    addPlayer(game, playerId);
    playerToSocket.set(playerId, socket.id);
    socketToPlayer.set(socket.id, playerId);
    playerToGame.set(playerId, data.gameId);
    socket.join(data.gameId);

    try {
      await savePlayer(data.gameId, playerId, 2);
      await persistGame(game);
    } catch (e) { console.error('DB save error:', e); }

    const p1SocketId = playerToSocket.get(game.playerOrder[0]);
    if (p1SocketId) io.to(p1SocketId).emit('opponent-joined');

    cb({ success: true, playerId });
  });

  socket.on('place-ships', async (data, cb) => {
    const game = games.get(data.gameId);
    if (!game) return cb({ success: false, error: 'Game not found' });

    const error = placeShips(game, data.playerId, data.ships);
    if (error) return cb({ success: false, error });

    cb({ success: true });

    try {
      await savePlayer(data.gameId, data.playerId, game.playerOrder.indexOf(data.playerId) + 1, data.ships);
    } catch (e) { console.error('DB save error:', e); }

    if (allPlayersReady(game)) {
      startFiring(game);
      io.to(data.gameId).emit('game-start', { currentTurn: game.currentTurn });
    }

    await persistGame(game);
  });

  socket.on('fire-shot', async (data, cb) => {
    const game = games.get(data.gameId);
    if (!game) return cb({ success: false, error: 'Game not found' });

    const result = fireShot(game, data.playerId, data.row, data.col);
    if (typeof result === 'string') return cb({ success: false, error: result });

    const shotResult = result as ShotResult;
    cb({ success: true, result: shotResult });

    try {
      await saveMove(data.gameId, data.playerId, 'fire', shotResult.row, shotResult.col, shotResult.result, shotResult.sunkShip);
    } catch (e) { console.error('DB save error:', e); }

    const opponentId = game.playerOrder.find((id) => id !== data.playerId)!;
    if (opponentId !== 'ai') {
      const oppSocketId = playerToSocket.get(opponentId);
      if (oppSocketId) io.to(oppSocketId).emit('opponent-shot', shotResult);
    }

    if (game.phase === 'over') {
      io.to(data.gameId).emit('game-over', { winner: game.winner });
      try { await finishGame(data.gameId, game.winner!); } catch (e) { console.error('DB save error:', e); }
      await persistGame(game);
      return;
    }

    if (game.mode === 'ai' && game.currentTurn === 'ai') {
      setTimeout(async () => {
        const aiShot = aiChooseShot(game);
        const aiResult = fireShot(game, 'ai', aiShot.row, aiShot.col);
        if (typeof aiResult !== 'string') {
          try {
            await saveMove(data.gameId, 'ai', 'fire', aiResult.row, aiResult.col, aiResult.result, aiResult.sunkShip);
          } catch (e) { console.error('DB save error:', e); }

          const humanSocketId = playerToSocket.get(data.playerId);
          if (humanSocketId) io.to(humanSocketId).emit('opponent-shot', aiResult);

          if (game.phase === 'over') {
            io.to(data.gameId).emit('game-over', { winner: game.winner });
            try { await finishGame(data.gameId, game.winner!); } catch (e) { console.error('DB save error:', e); }
          } else {
            io.to(data.gameId).emit('turn-change', { currentTurn: game.currentTurn });
          }
          await persistGame(game);
        }
      }, 800);
    } else {
      io.to(data.gameId).emit('turn-change', { currentTurn: game.currentTurn });
      await persistGame(game);
    }
  });

  socket.on('disconnect', () => {
    const playerId = socketToPlayer.get(socket.id);
    if (playerId) {
      socketToPlayer.delete(socket.id);
      // Notify opponent
      const gameId = playerToGame.get(playerId);
      if (gameId) {
        const game = games.get(gameId);
        if (game && game.phase !== 'over') {
          const opponentId = game.playerOrder.find((id) => id !== playerId);
          if (opponentId && opponentId !== 'ai') {
            const oppSocketId = playerToSocket.get(opponentId);
            if (oppSocketId) io.to(oppSocketId).emit('opponent-disconnected');
          }
        }
      }
    }
    console.log(`Disconnected: ${socket.id}`);
  });
});

async function start() {
  if (process.env.DATABASE_URL) {
    try { await initDb(); } catch (e) { console.error('DB init failed:', e); }
  } else {
    console.log('No DATABASE_URL — running without persistence');
  }

  const PORT = process.env.PORT || 3001;
  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
