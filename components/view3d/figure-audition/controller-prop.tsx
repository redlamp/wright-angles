"use client";

import { useMemo, useRef } from "react";
import { Group, MathUtils, MeshStandardMaterial, Vector3 } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useFrame } from "@react-three/fiber";

const SHELL = new MeshStandardMaterial({ color: "#2a2a2d", roughness: 0.75 });
const DARK = new MeshStandardMaterial({ color: "#151517", roughness: 0.6 });
const FACE = ["#4caf50", "#e53935", "#1e88e5", "#fdd835"].map(
  (c) => new MeshStandardMaterial({ color: c, roughness: 0.5 }),
);

const DEG = MathUtils.degToRad;

/** Geometries built once; centimeters. */
function useControllerGeometry() {
  return useMemo(
    () => ({
      body: new RoundedBoxGeometry(14.5, 3.4, 8.5, 3, 1.2),
      grip: new RoundedBoxGeometry(3.8, 9, 4.2, 3, 1.6),
      bumper: new RoundedBoxGeometry(4.5, 1.2, 2.2, 2, 0.5),
      trigger: new RoundedBoxGeometry(3, 2.2, 2.4, 2, 0.6),
    }),
    [],
  );
}

/** Thumbstick: a post and a dished cap. */
function Stick({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 1.7, z]}>
      <mesh material={DARK}>
        <cylinderGeometry args={[0.55, 0.55, 1.6, 10]} />
      </mesh>
      <mesh material={DARK} position={[0, 1.0, 0]}>
        <cylinderGeometry args={[1.25, 1.0, 0.5, 12]} />
      </mesh>
    </group>
  );
}

function DPad({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 1.85, z]}>
      <mesh material={DARK}>
        <boxGeometry args={[2.6, 0.5, 0.9]} />
      </mesh>
      <mesh material={DARK}>
        <boxGeometry args={[0.9, 0.5, 2.6]} />
      </mesh>
    </group>
  );
}

function FaceButtons({ x, z }: { x: number; z: number }) {
  const r = 0.95;
  const spots: [number, number][] = [
    [0, -r],
    [r, 0],
    [-r, 0],
    [0, r],
  ];
  return (
    <group position={[x, 1.85, z]}>
      {spots.map(([dx, dz], i) => (
        <mesh key={i} material={FACE[i]} position={[dx, 0, dz]}>
          <cylinderGeometry args={[0.42, 0.42, 0.45, 10]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A low-poly two-grip controller that sits between the hands: rounded
 * body, grips angling down and forward, two sticks, d-pad, four face
 * buttons, bumpers and triggers on the far edge. World cm; it follows
 * the midpoint of the wrist targets every frame and scales in and out
 * with the stance tween.
 */
export default function ControllerProp({
  targets,
  blend,
}: {
  targets: { current: Vector3[] };
  /** 0..1 presence; it grows out of the hands with the stance tween. */
  blend: { current: number };
}) {
  const ref = useRef<Group>(null);
  const mid = useMemo(() => new Vector3(), []);
  const geo = useControllerGeometry();
  useFrame(() => {
    const g = ref.current;
    const [l, r] = targets.current;
    if (!g || !l || !r) return;
    const b = blend.current;
    g.visible = b > 0.02;
    g.scale.setScalar(Math.max(1e-3, b));
    mid.addVectors(l, r).multiplyScalar(0.5);
    // Between the wrists, a little forward and up into the palms; the
    // top face tips toward the viewer's eyes.
    g.position.set(mid.x, mid.y + 1.5, mid.z + 1.5);
    g.rotation.set(DEG(-28), 0, 0);
  });
  return (
    <group ref={ref}>
      <mesh geometry={geo.body} material={SHELL} />
      {[-1, 1].map((sx) => (
        <group key={`g${sx}`} position={[sx * 5.2, -3.6, 1.8]} rotation={[DEG(-32), 0, sx * DEG(10)]}>
          <mesh geometry={geo.grip} material={SHELL} />
        </group>
      ))}
      {[-1, 1].map((sx) => (
        <group key={`b${sx}`}>
          <mesh geometry={geo.bumper} material={DARK} position={[sx * 4.2, 1.2, -3.9]} />
          <mesh geometry={geo.trigger} material={DARK} position={[sx * 4.2, -0.6, -4.8]} rotation={[DEG(20), 0, 0]} />
        </group>
      ))}
      {/* Left stick high-left, right stick low-right (Xbox layout). */}
      <Stick x={-4.4} z={-1.2} />
      <Stick x={2.4} z={1.6} />
      <DPad x={-2.4} z={1.8} />
      <FaceButtons x={4.4} z={-1.2} />
      {/* Center buttons. */}
      {[-1, 1].map((sx) => (
        <mesh key={`c${sx}`} material={DARK} position={[sx * 1.1, 1.8, -1.6]}>
          <cylinderGeometry args={[0.35, 0.35, 0.4, 8]} />
        </mesh>
      ))}
    </group>
  );
}
