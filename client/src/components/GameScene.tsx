import { useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
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
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const clampTarget = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const t = controls.target;
    const cam = controls.object.position;

    const clampedX = THREE.MathUtils.clamp(t.x, -12, 12);
    const clampedZ = THREE.MathUtils.clamp(t.z, -8, 8);

    const dx = clampedX - t.x;
    const dz = clampedZ - t.z;

    if (dx !== 0 || dz !== 0) {
      t.x = clampedX;
      t.z = clampedZ;
      cam.x += dx;
      cam.z += dz;
    }
    t.y = 0;
  }, []);

  return (
    <Canvas
      camera={{ position: [0, 16, 9], fov: 50 }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />
      <directionalLight position={[-3, 8, -3]} intensity={0.3} />

      <OrbitControls
        ref={controlsRef}
        enableRotate={false}
        enablePan={true}
        enableZoom={true}
        minDistance={5}
        maxDistance={25}
        onChange={clampTarget}
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
