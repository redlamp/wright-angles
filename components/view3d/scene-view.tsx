"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { useDeviceStore } from "@/stores/device-store";
import DeviceRect from "./device-rect";
import ViewerFigure, { EYE_HEIGHT_CM } from "./viewer-figure";

const BG = "#3a3a3a"; // ~oklch 0.25 0 0; sits between the dark theme's bg and card
const GROUND = "#333333";
const SIGHT_GRAY = "#8f8f8f";

/**
 * 3D viewing-geometry scene: a standing figure at the origin looking down +Z,
 * every visible device as a true-scale rect at its distance. 1 unit = 1cm.
 */
export default function SceneView() {
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const visible = [thisDevice, ...devices].filter((d) => d.visible);

  const farZ = Math.max(100, ...visible.map((d) => d.distanceCm));

  // Initial framing only — captured once; OrbitControls owns the camera after.
  const [initial] = useState(() => ({
    position: [
      -farZ * 1.7,
      EYE_HEIGHT_CM + farZ * 0.9,
      -farZ * 0.45,
    ] as [number, number, number],
    target: [0, EYE_HEIGHT_CM * 0.75, farZ * 0.55] as [number, number, number],
  }));

  return (
    <div className="h-full w-full">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: initial.position, fov: 40, near: 1, far: 20000 }}
        onCreated={({ gl, invalidate }) => {
          // Recover from GPU resets instead of going permanently black.
          const el = gl.domElement;
          el.addEventListener("webglcontextlost", (e) => e.preventDefault());
          el.addEventListener("webglcontextrestored", () => invalidate());
        }}
      >
        <color attach="background" args={[BG]} />

        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4000, 4000]} />
          <meshBasicMaterial color={GROUND} />
        </mesh>

        <ViewerFigure />

        <Line
          points={[
            [0, EYE_HEIGHT_CM, 0],
            [0, EYE_HEIGHT_CM, farZ + 80],
          ]}
          color={SIGHT_GRAY}
          lineWidth={1.5}
          dashed
          dashSize={6}
          gapSize={5}
        />

        {visible.map((d) => (
          <DeviceRect key={d.id} device={d} />
        ))}

        <OrbitControls
          makeDefault
          enableDamping
          target={initial.target}
          maxPolarAngle={Math.PI / 2 - 0.05}
          maxDistance={farZ * 6}
        />
      </Canvas>
    </div>
  );
}
