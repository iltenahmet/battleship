import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import type { ShotResult } from '../../../shared/types';

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
      <lineBasicMaterial color="#1a5276" transparent opacity={0.6} />
    </lineSegments>
  );
}

function ShotMarker({ shot }: { shot: ShotResult }) {
  const [x, , z] = cellToWorld(shot.row, shot.col);
  const color = shot.result === 'hit' ? '#e74c3c' : '#ecf0f1';
  return (
    <mesh position={[x, 0.15, z]}>
      <cylinderGeometry args={[0.12, 0.12, 0.3, 8]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

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
        <meshStandardMaterial color="#0d2137" transparent opacity={0.9} />
      </mesh>
      <GridLines />
      <HoverHighlight />
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

  return (
    <group position={[offsetX, 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BOARD_SIZE * CELL_SIZE, BOARD_SIZE * CELL_SIZE]} />
        <meshStandardMaterial color="#0d2137" transparent opacity={0.9} />
      </mesh>
      <GridLines />

      {/* Your ships */}
      {placedShips.map((ship) => {
        const cells: { row: number; col: number }[] = [];
        for (let i = 0; i < ship.length; i++) {
          const r = ship.orientation === 'vertical' ? ship.row + i : ship.row;
          const c = ship.orientation === 'horizontal' ? ship.col + i : ship.col;
          cells.push({ row: r, col: c });
        }
        const startPos = cellToWorld(cells[0].row, cells[0].col);
        const endPos = cellToWorld(cells[cells.length - 1].row, cells[cells.length - 1].col);
        const cx = (startPos[0] + endPos[0]) / 2;
        const cz = (startPos[2] + endPos[2]) / 2;
        const w = ship.orientation === 'horizontal' ? ship.length * CELL_SIZE * 0.85 : CELL_SIZE * 0.5;
        const d = ship.orientation === 'vertical' ? ship.length * CELL_SIZE * 0.85 : CELL_SIZE * 0.5;

        return (
          <mesh key={ship.name} position={[cx, 0.1, cz]}>
            <boxGeometry args={[w, 0.2, d]} />
            <meshStandardMaterial color="#5d6d7e" />
          </mesh>
        );
      })}

      {/* Incoming shots */}
      {opponentShots.map((shot) => (
        <ShotMarker key={`${shot.row}-${shot.col}`} shot={shot} />
      ))}
    </group>
  );
}
