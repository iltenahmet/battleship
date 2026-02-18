import { Canvas } from '@react-three/fiber';
import { useGameStore } from '../store/gameStore';
import Board3D from './Board3D';
import { AttackBoard, DefenseBoard } from './FiringBoard';

export default function GameScene() {
  const phase = useGameStore((s) => s.phase);

  return (
    <Canvas
      camera={{ position: [0, 14, 2.5], fov: 50 }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />

      {phase === 'placement' && <Board3D />}

      {(phase === 'firing' || phase === 'gameOver') && (
        <>
          <DefenseBoard offsetX={-6} />
          <AttackBoard offsetX={6} />
        </>
      )}
    </Canvas>
  );
}
