import { useRef, useMemo, useEffect } from 'react';
import { useGLTF, useTexture } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';
import * as THREE from 'three';

const CELL_SIZE = 1;
const BOARD_SIZE = 10;
const HALF = (BOARD_SIZE * CELL_SIZE) / 2;

const SHIP_MODELS: Record<string, { file: string }> = {
  Carrier:    { file: '/models/ship-large.glb' },
  Battleship: { file: '/models/ship-cargo-a.glb' },
  Cruiser:    { file: '/models/ship-ocean-liner-small.glb' },
  Submarine:  { file: '/models/ship-small.glb' },
  Destroyer:  { file: '/models/boat-speed-a.glb' },
};

function cellToWorld(row: number, col: number): [number, number, number] {
  return [col - HALF + 0.5, 0, row - HALF + 0.5];
}

interface Ship3DProps {
  name: string;
  length: number;
  row: number;
  col: number;
  orientation: 'horizontal' | 'vertical';
  sunk?: boolean;
  offsetX?: number;
}

function ShipModel({ name, length, row, col, orientation, sunk = false, offsetX = 0 }: Ship3DProps) {
  const config = SHIP_MODELS[name] || SHIP_MODELS.Destroyer;
  const { scene } = useGLTF(config.file);
  const colormap = useTexture('/models/colormap.png');
  const ref = useRef<THREE.Group>(null);

  const position = useMemo(() => {
    const startPos = cellToWorld(row, col);
    const endRow = orientation === 'vertical' ? row + length - 1 : row;
    const endCol = orientation === 'horizontal' ? col + length - 1 : col;
    const endPos = cellToWorld(endRow, endCol);
    return [
      (startPos[0] + endPos[0]) / 2 + offsetX,
      0.05,
      (startPos[2] + endPos[2]) / 2,
    ] as [number, number, number];
  }, [row, col, orientation, length, offsetX]);

  // Non-uniform scale: stretch along main axis to fill cells, constrain cross axis
  const scaleVec = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);

    const targetLength = length * CELL_SIZE * 0.92;
    const targetWidth = CELL_SIZE * 0.55;

    // Figure out which model axis is the "long" one
    const modelLongAxis = size.x > size.z ? 'x' : 'z';
    const modelLongLen = modelLongAxis === 'x' ? size.x : size.z;
    const modelShortLen = modelLongAxis === 'x' ? size.z : size.x;

    const longScale = targetLength / modelLongLen;
    const shortScale = targetWidth / modelShortLen;
    const yScale = shortScale; // keep height proportional to width

    // Return [scaleX, scaleY, scaleZ]
    if (modelLongAxis === 'x') {
      return [longScale, yScale, shortScale] as [number, number, number];
    } else {
      return [shortScale, yScale, longScale] as [number, number, number];
    }
  }, [scene, length]);

  // Rotate so the model's long axis matches the placement orientation
  const baseRotation = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const modelAlongX = size.x > size.z;

    if (orientation === 'horizontal') {
      return modelAlongX ? 0 : Math.PI / 2;
    } else {
      return modelAlongX ? Math.PI / 2 : 0;
    }
  }, [scene, orientation]);

  const { sinkY, sinkRotation } = useSpring({
    sinkY: sunk ? -0.15 : 0,
    sinkRotation: sunk ? 0.35 : 0,
    config: { mass: 2, tension: 40, friction: 20 },
  });

  // Clone, re-center, and apply ship color
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const center = new THREE.Vector3();
    box.getCenter(center);
    clone.position.set(-center.x, -box.min.y, -center.z);

    // Apply colormap texture — use directly (don't clone) so Water's render passes don't break it
    colormap.colorSpace = THREE.SRGBColorSpace;
    colormap.flipY = false; // glTF UVs expect non-flipped textures
    colormap.needsUpdate = true;

    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshStandardMaterial({
          map: colormap,
          metalness: 0.1,
          roughness: 0.8,
        });
        child.material.needsUpdate = true;
      }
    });

    return clone;
  }, [scene, colormap]);

  // Grey out and fade sunk ships
  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        child.material.transparent = true;
        child.material.opacity = sunk ? 0.35 : 1;
        if (sunk) {
          child.material.color = new THREE.Color('#555555');
          child.material.map = null;
        }
        child.material.needsUpdate = true;
      }
    });
  }, [clonedScene, sunk]);

  return (
    <animated.group
      ref={ref}
      position-x={position[0]}
      position-y={sinkY.to(y => position[1] + y)}
      position-z={position[2]}
      rotation-x={sinkRotation}
      rotation-y={baseRotation}
    >
      <group scale={scaleVec}>
        <primitive object={clonedScene} />
      </group>
    </animated.group>
  );
}

Object.values(SHIP_MODELS).forEach(m => useGLTF.preload(m.file));
useTexture.preload('/models/colormap.png');

export default ShipModel;
