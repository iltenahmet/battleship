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

function App() {
  const phase = useGameStore((s) => s.phase);
  const gameMode = useGameStore((s) => s.gameMode);
  const difficulty = useGameStore((s) => s.difficulty);
  const isMyTurn = useGameStore((s) => s.isMyTurn);
  const notification = useGameStore((s) => s.notification);
  const winner = useGameStore((s) => s.winner);
  const setGameMode = useGameStore((s) => s.setGameMode);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const startGame = useGameStore((s) => s.startGame);
  const goToMenu = useGameStore((s) => s.goToMenu);

  if (phase === 'menu') {
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
            vs Human
          </button>
        </div>

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
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col">
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

        {/* Turn indicator */}
        {phase === 'firing' && (
          <span className={`ml-auto px-3 py-1 rounded text-sm font-medium ${
            isMyTurn ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'
          }`}>
            {isMyTurn ? 'YOUR TURN' : "OPPONENT'S TURN"}
          </span>
        )}

        {/* Notification */}
        {notification && (
          <span className="ml-2 text-sm text-gray-300">{notification}</span>
        )}
      </div>

      {/* Game area */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <GameScene />

          {/* Board labels during firing */}
          {(phase === 'firing' || phase === 'gameOver') && (
            <>
              <div className="absolute bottom-4 left-[25%] -translate-x-1/2 text-cyan-400/60 text-sm tracking-wider">
                YOUR FLEET
              </div>
              <div className="absolute bottom-4 left-[75%] -translate-x-1/2 text-cyan-400/60 text-sm tracking-wider">
                ENEMY WATERS
              </div>
            </>
          )}
        </div>

        {/* Sidebar */}
        {phase === 'placement' && <PlacementUI />}

        {phase === 'waiting' && (
          <div className="w-[260px] flex items-center justify-center text-gray-500 p-6">
            <p>Waiting for game to start...</p>
          </div>
        )}

        {phase === 'gameOver' && (
          <div className="w-[260px] flex flex-col items-center justify-center gap-4 p-6">
            <h3 className={`text-2xl font-bold ${winner === 'you' ? 'text-emerald-400' : 'text-red-400'}`}>
              {winner === 'you' ? 'VICTORY!' : 'DEFEAT'}
            </h3>
            <button
              className="px-6 py-3 bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 rounded-lg cursor-pointer hover:bg-cyan-400/20"
              onClick={goToMenu}
            >
              Back to Menu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
