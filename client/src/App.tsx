import { useGameStore } from './store/gameStore';
import GameScene from './components/GameScene';
import PlacementUI from './components/PlacementUI';

function App() {
  const phase = useGameStore((s) => s.phase);
  const gameMode = useGameStore((s) => s.gameMode);
  const setPhase = useGameStore((s) => s.setPhase);
  const setGameMode = useGameStore((s) => s.setGameMode);
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
            onClick={() => { setGameMode('ai'); setPhase('placement'); }}
          >
            vs AI
          </button>
          <button
            className="px-8 py-4 text-lg bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 rounded-lg cursor-pointer transition-all hover:bg-cyan-400/20 hover:border-cyan-400 hover:-translate-y-0.5"
            onClick={() => { setGameMode('multiplayer'); setPhase('placement'); }}
          >
            vs Human
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col">
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
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <GameScene />
        </div>
        {phase === 'placement' && <PlacementUI />}
        {phase === 'firing' && (
          <div className="flex items-center justify-center w-[260px] text-gray-600">
            <p>Firing phase coming next...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
