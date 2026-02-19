import { useMemo, type ReactNode } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, SHIPS, isValidPlacement } from '../store/gameStore';
import ShipModel from './Ship3D';

const CELL_SIZE = 1;
const BOARD_SIZE = 10;
const HALF = (BOARD_SIZE * CELL_SIZE) / 2;

// Convert world position to grid cell
function worldToCell(point: THREE.Vector3): { row: number; col: number } | null {
  const col = Math.floor(point.x + HALF);
  const row = Math.floor(point.z + HALF);
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
  return { row, col };
}

// Convert grid cell to world center position
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

function CellHighlight({ row, col, color }: { row: number; col: number; color: string }) {
  const [x, y, z] = cellToWorld(row, col);
  return (
    <mesh position={[x, y + 0.005, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[CELL_SIZE * 0.95, CELL_SIZE * 0.95]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} />
    </mesh>
  );
}

function GhostShip() {
  const hoveredCell = useGameStore((s) => s.hoveredCell);
  const currentShipIndex = useGameStore((s) => s.currentShipIndex);
  const orientation = useGameStore((s) => s.orientation);
  const placedShips = useGameStore((s) => s.placedShips);

  if (!hoveredCell || currentShipIndex >= SHIPS.length) return null;

  const ship = SHIPS[currentShipIndex];
  const valid = isValidPlacement(
    hoveredCell.row,
    hoveredCell.col,
    ship.length,
    orientation,
    placedShips,
  );
  const color = valid ? '#2ecc71' : '#e74c3c';

  const cells: { row: number; col: number }[] = [];
  for (let i = 0; i < ship.length; i++) {
    const r = orientation === 'vertical' ? hoveredCell.row + i : hoveredCell.row;
    const c = orientation === 'horizontal' ? hoveredCell.col + i : hoveredCell.col;
    if (r < BOARD_SIZE && c < BOARD_SIZE) {
      cells.push({ row: r, col: c });
    }
  }

  return (
    <>
      {cells.map((cell) => (
        <CellHighlight key={`${cell.row}-${cell.col}`} row={cell.row} col={cell.col} color={color} />
      ))}
    </>
  );
}

function PlacedShips() {
  const placedShips = useGameStore((s) => s.placedShips);

  return (
    <>
      {placedShips.map((ship) => (
        <ShipModel
          key={ship.name}
          name={ship.name}
          length={ship.length}
          row={ship.row}
          col={ship.col}
          orientation={ship.orientation}
        />
      ))}
    </>
  );
}

function CoordinateLabels() {
  const labels: ReactNode[] = [];
  const letters = 'ABCDEFGHIJ';

  for (let i = 0; i < BOARD_SIZE; i++) {
    // Row labels (A-J) on left side
    const [, , z] = cellToWorld(i, 0);
    labels.push(
      <sprite key={`row-${i}`} position={[-HALF - 0.5, 0.1, z]} scale={[0.4, 0.4, 1]}>
        <spriteMaterial>
          <canvasTexture
            attach="map"
            image={(() => {
              const canvas = document.createElement('canvas');
              canvas.width = 64;
              canvas.height = 64;
              const ctx = canvas.getContext('2d')!;
              ctx.fillStyle = '#4fc3f7';
              ctx.font = 'bold 48px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(letters[i], 32, 32);
              return canvas;
            })()}
          />
        </spriteMaterial>
      </sprite>,
    );

    // Column labels (1-10) on top
    const [x] = cellToWorld(0, i);
    labels.push(
      <sprite key={`col-${i}`} position={[x, 0.1, -HALF - 0.5]} scale={[0.4, 0.4, 1]}>
        <spriteMaterial>
          <canvasTexture
            attach="map"
            image={(() => {
              const canvas = document.createElement('canvas');
              canvas.width = 64;
              canvas.height = 64;
              const ctx = canvas.getContext('2d')!;
              ctx.fillStyle = '#4fc3f7';
              ctx.font = 'bold 48px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(`${i + 1}`, 32, 32);
              return canvas;
            })()}
          />
        </spriteMaterial>
      </sprite>,
    );
  }

  return <>{labels}</>;
}

export default function Board3D() {
  const setHoveredCell = useGameStore((s) => s.setHoveredCell);
  const placeShip = useGameStore((s) => s.placeShip);
  const currentShipIndex = useGameStore((s) => s.currentShipIndex);

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const cell = worldToCell(e.point);
    setHoveredCell(cell);
  };

  const handlePointerLeave = () => {
    setHoveredCell(null);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (currentShipIndex >= SHIPS.length) return;
    const cell = worldToCell(e.point);
    if (cell) {
      placeShip(cell.row, cell.col);
    }
  };

  return (
    <group>
      {/* Water surface */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
      >
        <planeGeometry args={[BOARD_SIZE * CELL_SIZE, BOARD_SIZE * CELL_SIZE]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.5} />
      </mesh>

      <GridLines />
      <CoordinateLabels />
      <GhostShip />
      <PlacedShips />
    </group>
  );
}
