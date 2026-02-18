import { Canvas } from '@react-three/fiber';
import Board3D from './Board3D';

export default function GameScene() {
  return (
    <Canvas
      camera={{ position: [0, 14, 2.5], fov: 50 }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />
      <Board3D />
    </Canvas>
  );
}
