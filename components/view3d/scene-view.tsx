"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from "three";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Line, OrbitControls, useVideoTexture } from "@react-three/drei";
import type { Device } from "@/lib/types";
import { physicalSizeCm } from "@/lib/display-math";
import { useDeviceStore } from "@/stores/device-store";
import { useMediaStore } from "@/stores/media-store";
import { useSettingsStore, type DisplayMode } from "@/stores/settings-store";
import { eyeHeightCm, useViewerStore } from "@/stores/viewer-store";
import { useSceneTheme } from "@/lib/use-theme";
import DeviceRect from "./device-rect";
import ViewerFigure from "./viewer-figure";
import ScenarioProps from "./scenario-props";
import CameraRig, { type CameraPose } from "./camera-rig";
import SceneHud, { FPS_NODE_ID } from "./scene-hud";
import { SCENE_PALETTES } from "./scene-palette";

/**
 * Every screen surface faces +Z, away from the viewer at -Z, who therefore
 * sees back faces. Mirror U once on the shared texture so content reads
 * correctly from the viewer's side (instead of rotating every screen).
 */
function initScreenTexture(tex: Texture) {
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.repeat.x = -1;
  tex.offset.x = 1;
  tex.needsUpdate = true;
}

function useScreenTexture(tex: Texture) {
  useEffect(() => initScreenTexture(tex), [tex]);
}

function ImageScreens({
  url,
  children,
}: {
  url: string;
  children: (tex: Texture) => ReactNode;
}) {
  const tex = useLoader(TextureLoader, url);
  useScreenTexture(tex);
  return <>{children(tex)}</>;
}

function VideoScreens({
  url,
  children,
}: {
  url: string;
  children: (tex: Texture) => ReactNode;
}) {
  const tex = useVideoTexture(url, { muted: true, loop: true });
  useScreenTexture(tex);
  return <>{children(tex)}</>;
}

/**
 * Vertical fov that makes the head-on camera see exactly what the 2D view
 * shows in this window: the window height mapped through the 2D scale into
 * device pixels, then through the panel's pixel pitch into physical size,
 * subtended from the viewing distance. This is what makes the 2D↔3D swap
 * land without a visual jump.
 */
function headOnFovDeg(thisDevice: Device, displayMode: DisplayMode): number {
  if (typeof window === "undefined") return 40;
  const res = thisDevice.resolution;
  const k =
    displayMode === "viewport"
      ? window.screen.width / res.w
      : Math.min(window.innerWidth / res.w, window.innerHeight / res.h);
  if (!k) return 40;
  const visibleDevicePx = window.innerHeight / k;
  const { heightCm } = physicalSizeCm(thisDevice.diagonalIn, thisDevice.aspect);
  const physH = (visibleDevicePx / res.h) * heightCm;
  const fov =
    2 * Math.atan(physH / 2 / thisDevice.distanceCm) * (180 / Math.PI);
  return Math.min(120, Math.max(5, fov));
}

/** Smoothed FPS, written to the HUD's DOM node at ~2Hz — no setState. */
function FpsProbe() {
  const ema = useRef(0);
  const acc = useRef(1); // start "due" so the first frame writes immediately
  useFrame((_, delta) => {
    if (delta <= 0) return;
    const inst = 1 / delta;
    ema.current = ema.current === 0 ? inst : ema.current + (inst - ema.current) * 0.1;
    acc.current += delta;
    if (acc.current >= 0.5) {
      acc.current = 0;
      const el = document.getElementById(FPS_NODE_ID);
      if (el) el.textContent = String(Math.round(ema.current));
    }
  });
  return null;
}

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
  const palette = SCENE_PALETTES[useSceneTheme()];
  const visible = [thisDevice, ...devices].filter((d) => d.visible);

  const items = useMediaStore((s) => s.items);
  const activeId = useMediaStore((s) => s.activeId);
  const objectUrls = useMediaStore((s) => s.objectUrls);
  const videoUrls = useMediaStore((s) => s.videoUrls);
  const activeItem = items.find((i) => i.id === activeId) ?? null;
  const videoUrl = activeItem?.kind === "video" ? videoUrls[activeItem.id] : undefined;
  // For videos the objectUrl is the poster frame — a fallback if the
  // playable URL is somehow missing.
  const imageUrl = activeItem ? objectUrls[activeItem.id] : undefined;

  const eyeH = eyeHeightCm(scenario, heightCm);
  const farZ = Math.max(100, ...visible.map((d) => d.distanceCm));

  const displayMode = useSettingsStore((s) => s.displayMode);

  // Orbit framing captured once; OrbitControls owns the camera after entry.
  const [orbitPose] = useState<CameraPose>(() => ({
    position: [-farZ * 1.7, eyeH + farZ * 0.9, -farZ * 0.45],
    target: [0, eyeH * 0.75, farZ * 0.55],
    fov: 40,
  }));
  // Head-on pose tracks the live eye height and the 2D view's actual
  // visible angle so both ends of the transition line up with 2D.
  const fov = useMemo(
    () => headOnFovDeg(thisDevice, displayMode),
    [thisDevice, displayMode],
  );
  const headOnPose: CameraPose = {
    position: [0, eyeH, 0],
    target: [0, eyeH, farZ],
    fov,
  };
  const [controlsOn, setControlsOn] = useState(false);

  // The media texture is loaded ONCE here and shared by every rect.
  const rects = (tex: Texture | null) =>
    visible.map((d) => (
      <DeviceRect
        key={d.id}
        device={d}
        eyeHeight={eyeH}
        palette={palette}
        media={
          tex && activeItem
            ? { texture: tex, width: activeItem.width, height: activeItem.height }
            : null
        }
      />
    ));

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={[1, 2]}
        camera={{
          position: headOnPose.position,
          fov: headOnPose.fov,
          near: 1,
          far: 20000,
        }}
        onCreated={({ gl, invalidate }) => {
          // Recover from GPU resets instead of going permanently black.
          const el = gl.domElement;
          el.addEventListener("webglcontextlost", (e) => e.preventDefault());
          el.addEventListener("webglcontextrestored", () => invalidate());
        }}
      >
        <color attach="background" args={[palette.bg]} />

        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4000, 4000]} />
          <meshBasicMaterial color={palette.ground} />
        </mesh>

        <ViewerFigure scenario={scenario} heightCm={heightCm} palette={palette} />
        <ScenarioProps scenario={scenario} palette={palette} />

        <Line
          points={[
            [0, eyeH, 0],
            [0, eyeH, farZ + 80],
          ]}
          color={palette.sight}
          lineWidth={1.5}
          dashed
          dashSize={6}
          gapSize={5}
        />

        {/* Fallback keeps the plain rects up while a texture loads. */}
        <Suspense fallback={rects(null)}>
          {activeItem && (videoUrl || imageUrl) ? (
            videoUrl ? (
              <VideoScreens url={videoUrl}>{rects}</VideoScreens>
            ) : (
              <ImageScreens url={imageUrl!}>{rects}</ImageScreens>
            )
          ) : (
            rects(null)
          )}
        </Suspense>

        <FpsProbe />

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
