"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { useDeviceStore } from "@/stores/device-store";
import { eyeHeightCm, useViewerStore } from "@/stores/viewer-store";
import DeviceRect from "./device-rect";
import ViewerFigure from "./viewer-figure";
import ScenarioProps from "./scenario-props";
import CameraRig, { type CameraPose } from "./camera-rig";
import SceneHud from "./scene-hud";

const BG = "#3a3a3a"; // ~oklch 0.25 0 0; sits between the dark theme's bg and card
const GROUND = "#333333";
const SIGHT_GRAY = "#8f8f8f";

/**
 * 3D viewing-geometry scene: the posed viewer at the origin looking down +Z,
 * every visible device as a true-scale rect at its distance. 1 unit = 1cm.
 *
 * Mount opens head-on at the eye point (matching the 2D overlay) and flies
 * to a 3/4 orbit; flipping `exiting` flies back and calls onExited once, so
 * the parent can unmount behind the 2D view.
 */
export default function SceneView({
  exiting = false,
  onExited,
}: {
  exiting?: boolean;
  onExited?: () => void;
}) {
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const scenario = useViewerStore((s) => s.scenario);
  const heightCm = useViewerStore((s) => s.heightCm);
  const visible = [thisDevice, ...devices].filter((d) => d.visible);

  const eyeH = eyeHeightCm(scenario, heightCm);
  const farZ = Math.max(100, ...visible.map((d) => d.distanceCm));

  // Orbit framing captured once; OrbitControls owns the camera after entry.
  const [orbitPose] = useState<CameraPose>(() => ({
    position: [-farZ * 1.7, eyeH + farZ * 0.9, -farZ * 0.45],
    target: [0, eyeH * 0.75, farZ * 0.55],
  }));
  // Head-on pose tracks the live eye height so the exit lines up with 2D.
  const headOnPose: CameraPose = {
    position: [0, eyeH, 0],
    target: [0, eyeH, farZ],
  };
  const [controlsOn, setControlsOn] = useState(false);

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: headOnPose.position, fov: 40, near: 1, far: 20000 }}
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

        <ViewerFigure scenario={scenario} heightCm={heightCm} />
        <ScenarioProps scenario={scenario} />

        <Line
          points={[
            [0, eyeH, 0],
            [0, eyeH, farZ + 80],
          ]}
          color={SIGHT_GRAY}
          lineWidth={1.5}
          dashed
          dashSize={6}
          gapSize={5}
        />

        {visible.map((d) => (
          <DeviceRect key={d.id} device={d} eyeHeight={eyeH} />
        ))}

        <CameraRig
          orbitPose={orbitPose}
          headOnPose={headOnPose}
          exiting={exiting}
          onExited={onExited}
          onControlsChange={setControlsOn}
        />
        {/* Mounted only while the rig is idle so its update loop never
            fights the fly-in/out; on remount it re-syncs from the camera. */}
        {controlsOn ? (
          <OrbitControls
            makeDefault
            enableDamping
            target={orbitPose.target}
            maxPolarAngle={Math.PI / 2 - 0.05}
            maxDistance={farZ * 6}
          />
        ) : null}
      </Canvas>
      <SceneHud />
    </div>
  );
}
