import { useState } from 'react';
import './App.css';

type Screen = 'menu' | 'game';
type GameMode = 'ai' | 'multiplayer';

function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [gameMode, setGameMode] = useState<GameMode | null>(null);

  if (screen === 'menu') {
    return (
      <div className="menu">
        <h1>BATTLESHIP</h1>
        <p className="subtitle">Naval Combat Strategy Game</p>
        <div className="menu-buttons">
          <button
            onClick={() => {
              setGameMode('ai');
              setScreen('game');
            }}
          >
            vs AI
          </button>
          <button
            onClick={() => {
              setGameMode('multiplayer');
              setScreen('game');
            }}
          >
            vs Human
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-container">
      <div className="game-header">
        <button className="back-btn" onClick={() => { setScreen('menu'); setGameMode(null); }}>
          ← Menu
        </button>
        <h2>BATTLESHIP — {gameMode === 'ai' ? 'vs AI' : 'vs Human'}</h2>
      </div>
      <div className="game-placeholder">
        <p>Game board will render here</p>
      </div>
    </div>
  );
}

export default App;
