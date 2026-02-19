import { useState, useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import type { AIDifficulty } from '../../shared/types';
import GameScene from './components/GameScene';
import PlacementUI from './components/PlacementUI';

const DIFFICULTIES: { value: AIDifficulty; label: string; desc: string }[] = [
  { value: 'easy', label: 'Easy', desc: 'Random shots' },
  { value: 'medium', label: 'Medium', desc: 'Hunt + Target' },
  { value: 'hard', label: 'Hard', desc: 'Hunt + Parity' },
  { value: 'expert', label: 'Expert', desc: 'Probability Density' },
];

function LobbyScreen() {
  const gameId = useGameStore((s) => s.gameId);
  const notification = useGameStore((s) => s.notification);
  const goToMenu = useGameStore((s) => s.goToMenu);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6">
      <h2 className="text-2xl text-cyan-400 tracking-wider">WAITING FOR OPPONENT</h2>
      <div className="flex flex-col items-center gap-2">
        <p className="text-gray-400 text-sm">Share this room code:</p>
        <div className="text-5xl font-bold tracking-[0.4em] text-cyan-300 bg-cyan-400/10 px-8 py-4 rounded-lg border border-cyan-400/30 select-all">
          {gameId}
        </div>
      </div>
      {notification && <p className="text-gray-500 text-sm">{notification}</p>}
      <button
        className="px-4 py-2 text-sm bg-transparent border border-gray-600 text-gray-400 rounded cursor-pointer hover:border-cyan-400 hover:text-cyan-400 transition-all"
        onClick={goToMenu}
      >
        ← Cancel
      </button>
    </div>
  );
}

function MenuScreen() {
  const [joinCode, setJoinCode] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const difficulty = useGameStore((s) => s.difficulty);
  const notification = useGameStore((s) => s.notification);
  const setGameMode = useGameStore((s) => s.setGameMode);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const startGame = useGameStore((s) => s.startGame);
  const joinGame = useGameStore((s) => s.joinGame);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-6xl tracking-[0.3em] text-cyan-400 m-0" style={{ textShadow: '0 0 20px rgba(79,195,247,0.3)' }}>
        BATTLESHIP
      </h1>
      <p className="text-gray-500 text-lg mb-8">Naval Combat Strategy Game</p>

      <div className="flex flex-col gap-4 w-60">
        <button
          className="px-8 py-4 text-lg bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 rounded-lg cursor-pointer transition-all hover:bg-cyan-400/20 hover:border-cyan-400 hover:-translate-y-0.5"
          onClick={() => { setGameMode('ai'); startGame(); }}
        >
          vs AI
        </button>
        <button
          className="px-8 py-4 text-lg bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 rounded-lg cursor-pointer transition-all hover:bg-cyan-400/20 hover:border-cyan-400 hover:-translate-y-0.5"
          onClick={() => { setGameMode('multiplayer'); startGame(); }}
        >
          Create Game
        </button>
        <button
          className="px-8 py-4 text-lg bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 rounded-lg cursor-pointer transition-all hover:bg-cyan-400/20 hover:border-cyan-400 hover:-translate-y-0.5"
          onClick={() => setShowJoin(true)}
        >
          Join Game
        </button>
      </div>

      {/* Join game input */}
      {showJoin && (
        <div className="flex gap-2 mt-4 items-center">
          <input
            className="px-4 py-2 bg-white/5 border border-gray-600 text-cyan-300 rounded text-center text-lg tracking-[0.3em] uppercase w-40 outline-none focus:border-cyan-400"
            placeholder="CODE"
            maxLength={8}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter' && joinCode) { setGameMode('multiplayer'); joinGame(joinCode); } }}
            autoFocus
          />
          <button
            className="px-4 py-2 bg-emerald-500/15 border border-emerald-500 text-emerald-400 rounded cursor-pointer hover:bg-emerald-500/30 disabled:opacity-40"
            disabled={!joinCode}
            onClick={() => { setGameMode('multiplayer'); joinGame(joinCode); }}
          >
            Join
          </button>
        </div>
      )}

      {/* Difficulty selector */}
      <div className="flex gap-2 mt-4">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.value}
            className={`px-3 py-2 text-xs rounded border transition-all cursor-pointer
              ${difficulty === d.value
                ? 'bg-cyan-400/20 border-cyan-400 text-cyan-400'
                : 'bg-white/5 border-gray-600 text-gray-400 hover:border-gray-400'
              }`}
            onClick={() => setDifficulty(d.value)}
            title={d.desc}
          >
            {d.label}
          </button>
        ))}
      </div>
      <p className="text-gray-600 text-xs">AI Difficulty (for vs AI)</p>

      {notification && <p className="text-red-400 text-sm mt-2">{notification}</p>}
    </div>
  );
}

function App() {
  const phase = useGameStore((s) => s.phase);
  const gameMode = useGameStore((s) => s.gameMode);
  const isMyTurn = useGameStore((s) => s.isMyTurn);
  const notification = useGameStore((s) => s.notification);
  const winner = useGameStore((s) => s.winner);
  const goToMenu = useGameStore((s) => s.goToMenu);
  const tryReconnect = useGameStore((s) => s.tryReconnect);

  useEffect(() => {
    tryReconnect();
  }, [tryReconnect]);

  if (phase === 'menu') return <MenuScreen />;
  if (phase === 'lobby') return <LobbyScreen />;

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Game Over popup */}
      {phase === 'gameOver' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-6 bg-[#0d1117] border border-gray-700 rounded-2xl px-12 py-10 shadow-2xl">
            <h2 className={`text-5xl font-bold tracking-wider ${winner === 'you' ? 'text-emerald-400' : 'text-red-400'}`}
              style={{ textShadow: winner === 'you' ? '0 0 30px rgba(52,211,153,0.4)' : '0 0 30px rgba(248,113,113,0.4)' }}
            >
              {winner === 'you' ? 'VICTORY' : 'DEFEAT'}
            </h2>
            <p className="text-gray-400 text-sm">
              {winner === 'you' ? 'You sunk all enemy ships!' : 'Your fleet has been destroyed.'}
            </p>
            <div className="flex gap-4">
              {gameMode === 'ai' && (
                <button
                  className="px-6 py-3 bg-emerald-500/15 border border-emerald-500 text-emerald-400 rounded-lg cursor-pointer hover:bg-emerald-500/30 transition-all"
                  onClick={() => {
                    goToMenu();
                    setTimeout(() => {
                      useGameStore.getState().setGameMode('ai');
                      useGameStore.getState().startGame();
                    }, 100);
                  }}
                >
                  Rematch
                </button>
              )}
              <button
                className="px-6 py-3 bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 rounded-lg cursor-pointer hover:bg-cyan-400/20 transition-all"
                onClick={goToMenu}
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 bg-black/30 shrink-0">
        <button
          className="px-3 py-1.5 text-sm bg-transparent border border-gray-600 text-gray-400 rounded cursor-pointer hover:border-cyan-400 hover:text-cyan-400 transition-all"
          onClick={goToMenu}
        >
          ← Menu
        </button>
        <h2 className="m-0 text-lg text-cyan-400 tracking-wider">
          BATTLESHIP — {gameMode === 'ai' ? 'vs AI' : 'vs Human'}
        </h2>

        {phase === 'firing' && (
          <span className={`ml-auto px-3 py-1 rounded text-sm font-medium ${
            isMyTurn ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'
          }`}>
            {isMyTurn ? 'YOUR TURN' : "OPPONENT'S TURN"}
          </span>
        )}

        {notification && phase !== 'gameOver' && (
          <span className="ml-2 text-sm text-gray-300">{notification}</span>
        )}
      </div>

      {/* Game area */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <GameScene />

          {(phase === 'firing' || phase === 'gameOver') && (
            <>
              <div className="absolute bottom-4 left-[25%] -translate-x-1/2 text-cyan-400 text-sm tracking-wider bg-black/60 px-4 py-1.5 rounded">
                YOUR FLEET
              </div>
              <div className="absolute bottom-4 left-[75%] -translate-x-1/2 text-cyan-400 text-sm tracking-wider bg-black/60 px-4 py-1.5 rounded">
                ENEMY WATERS
              </div>
            </>
          )}

          {/* Controls hint */}
          {phase !== 'menu' && phase !== 'lobby' && (
            <div className="absolute top-2 right-2 text-gray-500 text-xs bg-black/50 px-3 py-2 rounded flex flex-col gap-0.5">
              <span>Click on enemy waters to fire</span>
              <span>Scroll to zoom</span>
              <span>Hold right click and drag to move camera</span>
            </div>
          )}
        </div>

        {phase === 'placement' && <PlacementUI />}

        {phase === 'waiting' && (
          <div className="w-[260px] flex items-center justify-center text-gray-500 p-6">
            <p>Waiting for opponent to place ships...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
