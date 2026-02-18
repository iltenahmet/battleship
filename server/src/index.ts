import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  Game, createGame, addPlayer, placeShips, allPlayersReady,
  startFiring, fireShot, aiChooseShot, aiPlaceShips,
} from './game';
import { ShotResult } from '../../shared/types';

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

// In-memory game store
const games = new Map<string, Game>();
const playerToSocket = new Map<string, string>(); // playerId -> socketId
const socketToPlayer = new Map<string, string>(); // socketId -> playerId

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientPath));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on('create-game', (data, cb) => {
    const gameId = uuidv4().slice(0, 8).toUpperCase();
    const playerId = uuidv4();
    const game = createGame(gameId, data.mode, data.mode === 'ai' ? data.difficulty : undefined);
    addPlayer(game, playerId);

    // For AI games, add AI player and place its ships
    if (data.mode === 'ai') {
      const aiId = 'ai';
      addPlayer(game, aiId);
      const aiShips = aiPlaceShips();
      placeShips(game, aiId, aiShips);
    }

    games.set(gameId, game);
    playerToSocket.set(playerId, socket.id);
    socketToPlayer.set(socket.id, playerId);
    socket.join(gameId);

    cb({ gameId, playerId });
  });

  socket.on('join-game', (data, cb) => {
    const game = games.get(data.gameId);
    if (!game) return cb({ success: false, error: 'Game not found' });
    if (game.playerOrder.length >= 2) return cb({ success: false, error: 'Game is full' });

    const playerId = uuidv4();
    addPlayer(game, playerId);
    playerToSocket.set(playerId, socket.id);
    socketToPlayer.set(socket.id, playerId);
    socket.join(data.gameId);

    // Notify player 1
    const p1SocketId = playerToSocket.get(game.playerOrder[0]);
    if (p1SocketId) io.to(p1SocketId).emit('opponent-joined');

    cb({ success: true, playerId });
  });

  socket.on('place-ships', (data, cb) => {
    const game = games.get(data.gameId);
    if (!game) return cb({ success: false, error: 'Game not found' });

    const error = placeShips(game, data.playerId, data.ships);
    if (error) return cb({ success: false, error });

    cb({ success: true });

    // Check if both players ready
    if (allPlayersReady(game)) {
      startFiring(game);
      // Notify all players in the room
      io.to(data.gameId).emit('game-start', { currentTurn: game.currentTurn });
    }
  });

  socket.on('fire-shot', (data, cb) => {
    const game = games.get(data.gameId);
    if (!game) return cb({ success: false, error: 'Game not found' });

    const result = fireShot(game, data.playerId, data.row, data.col);
    if (typeof result === 'string') return cb({ success: false, error: result });

    const shotResult = result as ShotResult;
    cb({ success: true, result: shotResult });

    // Notify opponent of the shot on their board
    const opponentId = game.playerOrder.find((id) => id !== data.playerId)!;
    if (opponentId !== 'ai') {
      const oppSocketId = playerToSocket.get(opponentId);
      if (oppSocketId) {
        io.to(oppSocketId).emit('opponent-shot', shotResult);
      }
    }

    if (game.phase === 'over') {
      io.to(data.gameId).emit('game-over', { winner: game.winner });
      return;
    }

    // If AI game and it's AI's turn, fire back
    if (game.mode === 'ai' && game.currentTurn === 'ai') {
      setTimeout(() => {
        const aiShot = aiChooseShot(game);
        const aiResult = fireShot(game, 'ai', aiShot.row, aiShot.col);
        if (typeof aiResult !== 'string') {
          // Send AI's shot to the human player
          const humanSocketId = playerToSocket.get(data.playerId);
          if (humanSocketId) {
            io.to(humanSocketId).emit('opponent-shot', aiResult);
          }

          if (game.phase === 'over') {
            io.to(data.gameId).emit('game-over', { winner: game.winner });
          } else {
            io.to(data.gameId).emit('turn-change', { currentTurn: game.currentTurn });
          }
        }
      }, 800); // slight delay so it feels natural
    } else {
      io.to(data.gameId).emit('turn-change', { currentTurn: game.currentTurn });
    }
  });

  socket.on('disconnect', () => {
    const playerId = socketToPlayer.get(socket.id);
    if (playerId) {
      socketToPlayer.delete(socket.id);
      // Don't delete playerToSocket yet — allow reconnect
    }
    console.log(`Disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
