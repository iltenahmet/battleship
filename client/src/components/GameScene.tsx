import { useRef, useMemo } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { useGameStore } from '../store/gameStore';
import Board3D from './Board3D';
import { AttackBoard, DefenseBoard } from './FiringBoard';

// Extend R3F to recognize <water> in JSX
extend({ Water });

function Ocean() {
  const ref = useRef<Water>(null);

  const waterGeometry = useMemo(() => new THREE.PlaneGeometry(80, 80), []);

  const waterConfig = useMemo(() => ({
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: new THREE.TextureLoader().load(
      'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/waternormals.jpg',
      (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      }
    ),
    sunDirection: new THREE.Vector3(0.5, 0.8, 0.5),
    sunColor: 0xffffff,
    waterColor: 0x001e4d,
    distortionScale: 1.5,
    fog: false,
  }), []);

  useFrame((_state, delta) => {
    if (ref.current) {
      ref.current.material.uniforms['time'].value += delta * 0.5;
    }
  });

  return (
    // @ts-ignore - water is extended but TS doesn't know about it
    <water
      ref={ref}
      args={[waterGeometry, waterConfig]}
      rotation-x={-Math.PI / 2}
      position-y={-0.1}
    />
  );
}

export default function GameScene() {
  const phase = useGameStore((s) => s.phase);

  return (
    <Canvas
      camera={{ position: [0, 12, 7], fov: 50 }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />
      <directionalLight position={[-3, 8, -3]} intensity={0.3} />

      <OrbitControls
        enableRotate={false}
        enablePan={true}
        enableZoom={true}
        minDistance={5}
        maxDistance={25}
      />

      <Ocean />

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
