import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF, useTexture } from '@react-three/drei';
import { useGameStore } from '../store/gameStore';
import type { ShotResult } from '../../../shared/types';
import ShipModel from './Ship3D';

const CELL_SIZE = 1;
const BOARD_SIZE = 10;
const HALF = (BOARD_SIZE * CELL_SIZE) / 2;

function worldToCell(point: THREE.Vector3, offsetX: number = 0): { row: number; col: number } | null {
  const col = Math.floor(point.x - offsetX + HALF);
  const row = Math.floor(point.z + HALF);
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
  return { row, col };
}

function cellToWorld(row: number, col: number): [number, number, number] {
  return [col - HALF + 0.5, 0.01, row - HALF + 0.5];
}

function GridLines() {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pts: number[] = [];
    for (let i = 0; i <= BOARD_SIZE; i++) {
      pts.push(i * CELL_SIZE - HALF, 0.005, -HALF, i * CELL_SIZE - HALF, 0.005, HALF);
      pts.push(-HALF, 0.005, i * CELL_SIZE - HALF, HALF, 0.005, i * CELL_SIZE - HALF);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, []);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#4fc3f7" transparent opacity={0.5} />
    </lineSegments>
  );
}

function ShotMarker({ shot, raised = false }: { shot: ShotResult; raised?: boolean }) {
  const [x, , z] = cellToWorld(shot.row, shot.col);
  const isHit = shot.result === 'hit';
  const modelFile = isHit ? '/models/buoy-flag.glb' : '/models/buoy.glb';
  const { scene } = useGLTF(modelFile);
  const colormap = useTexture('/models/colormap.png');

  const clone = useMemo(() => {
    const c = scene.clone(true);
    const box = new THREE.Box3().setFromObject(c);
    const center = new THREE.Vector3();
    box.getSize(center);
    const size = Math.max(center.x, center.y, center.z);
    const scale = 0.6 / size;
    c.scale.setScalar(scale);

    // Re-center
    const box2 = new THREE.Box3().setFromObject(c);
    const mid = new THREE.Vector3();
    box2.getCenter(mid);
    c.position.set(-mid.x, -box2.min.y, -mid.z);

    // Apply colormap with original colors
    colormap.colorSpace = THREE.SRGBColorSpace;
    colormap.flipY = false;
    colormap.needsUpdate = true;

    c.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (isHit) {
          child.material = new THREE.MeshStandardMaterial({
            color: '#1a1a1a',
            metalness: 0.3,
            roughness: 0.6,
          });
        } else {
          child.material = new THREE.MeshStandardMaterial({
            map: colormap,
            metalness: 0.1,
            roughness: 0.8,
          });
        }
      }
    });

    return c;
  }, [scene, colormap]);

  // On defense board, raise hits above ships so they don't collide
  const yPos = raised && isHit ? 0.5 : 0.05;

  return (
    <group position={[x, yPos, z]}>
      <primitive object={clone} />
    </group>
  );
}

useGLTF.preload('/models/buoy.glb');
useGLTF.preload('/models/buoy-flag.glb');

function HoverHighlight() {
  const hoveredCell = useGameStore((s) => s.hoveredCell);
  const isMyTurn = useGameStore((s) => s.isMyTurn);
  const myShots = useGameStore((s) => s.myShots);

  if (!hoveredCell || !isMyTurn) return null;
  // Don't highlight already-shot cells
  if (myShots.some((s) => s.row === hoveredCell.row && s.col === hoveredCell.col)) return null;

  const [x, y, z] = cellToWorld(hoveredCell.row, hoveredCell.col);
  return (
    <mesh position={[x, y + 0.005, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[CELL_SIZE * 0.95, CELL_SIZE * 0.95]} />
      <meshBasicMaterial color="#f39c12" transparent opacity={0.4} />
    </mesh>
  );
}

// Opponent's board — where you fire
export function AttackBoard({ offsetX }: { offsetX: number }) {
  const setHoveredCell = useGameStore((s) => s.setHoveredCell);
  const fire = useGameStore((s) => s.fire);
  const isMyTurn = useGameStore((s) => s.isMyTurn);
  const myShots = useGameStore((s) => s.myShots);

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const cell = worldToCell(e.point, offsetX);
    setHoveredCell(cell);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!isMyTurn) return;
    const cell = worldToCell(e.point, offsetX);
    if (cell) fire(cell.row, cell.col);
  };

  return (
    <group position={[offsetX, 0, 0]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoveredCell(null)}
        onClick={handleClick}
      >
        <planeGeometry args={[BOARD_SIZE * CELL_SIZE, BOARD_SIZE * CELL_SIZE]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.5} />
      </mesh>
      <GridLines />
      <HoverHighlight />
      {/* Red highlights under hits */}
      {myShots.filter((s) => s.result === 'hit').map((shot) => {
        const [hx, hy, hz] = cellToWorld(shot.row, shot.col);
        return (
          <mesh key={`hit-${shot.row}-${shot.col}`} position={[hx, hy + 0.005, hz]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[CELL_SIZE * 0.95, CELL_SIZE * 0.95]} />
            <meshBasicMaterial color="#e74c3c" transparent opacity={0.5} />
          </mesh>
        );
      })}
      {myShots.map((shot) => (
        <ShotMarker key={`${shot.row}-${shot.col}`} shot={shot} />
      ))}
    </group>
  );
}

// Your board — shows your ships + incoming hits
export function DefenseBoard({ offsetX }: { offsetX: number }) {
  const placedShips = useGameStore((s) => s.placedShips);
  const opponentShots = useGameStore((s) => s.opponentShots);

  // Derive which of my ships are sunk
  const sunkShipNames = useMemo(() => {
    const names = new Set<string>();
    for (const shot of opponentShots) {
      if (shot.sunkShip) names.add(shot.sunkShip);
    }
    return names;
  }, [opponentShots]);

  return (
    <group position={[offsetX, 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BOARD_SIZE * CELL_SIZE, BOARD_SIZE * CELL_SIZE]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.5} />
      </mesh>
      <GridLines />

      {/* Your ships with sinking animation */}
      {placedShips.map((ship) => (
        <ShipModel
          key={ship.name}
          name={ship.name}
          length={ship.length}
          row={ship.row}
          col={ship.col}
          orientation={ship.orientation}
          sunk={sunkShipNames.has(ship.name)}
        />
      ))}

      {/* Red highlights under enemy hits */}
      {opponentShots.filter((s) => s.result === 'hit').map((shot) => {
        const [hx, hy, hz] = cellToWorld(shot.row, shot.col);
        return (
          <mesh key={`hit-${shot.row}-${shot.col}`} position={[hx, hy + 0.005, hz]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[CELL_SIZE * 0.95, CELL_SIZE * 0.95]} />
            <meshBasicMaterial color="#e74c3c" transparent opacity={0.5} />
          </mesh>
        );
      })}

      {/* Incoming shots — raise hits above ships */}
      {opponentShots.map((shot) => (
        <ShotMarker key={`${shot.row}-${shot.col}`} shot={shot} raised />
      ))}
    </group>
  );
}
