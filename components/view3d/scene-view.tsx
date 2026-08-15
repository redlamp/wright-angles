"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  VideoTexture,
  type Texture,
} from "three";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { getEngine, type GifEngine } from "@/lib/playback-engine";
import { usePlaybackStore } from "@/stores/playback-store";
import type { Device, MediaCrop } from "@/lib/types";
import { physicalSizeCm } from "@/lib/display-math";
import { effectiveDims } from "@/lib/media-crop";
import { useDeviceStore } from "@/stores/device-store";
import { useMediaStore } from "@/stores/media-store";
import { useSettingsStore, type DisplayMode } from "@/stores/settings-store";
import { eyeHeightCm, useViewerStore, type Scenario } from "@/stores/viewer-store";
import { useSceneTheme } from "@/lib/use-theme";
import DeviceRect, { type LabelPlacement } from "./device-rect";
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
/** Module-level so the react-compiler lint permits the mutation. */
function markTextureDirty(tex: Texture) {
  tex.needsUpdate = true;
}

/**
 * The crop composes with the U-mirror via repeat/offset (sampled uv' =
 * uv·repeat + offset). Three's UV origin is bottom-left while the crop is
 * y-down, so the crop's vertical window [y, y+h] sits at v ∈
 * [1−y−h, 1−y]: repeat.y = h, offset.y = 1−y−h. Mirrored U must run
 * right-to-left across the window [x, x+w]: u' = (x+w) − u·w, i.e.
 * repeat.x = −w, offset.x = x+w (no crop: −1 / 1, exactly today's mirror).
 */
function initScreenTexture(tex: Texture, crop?: MediaCrop) {
  const c = crop ?? { x: 0, y: 0, w: 1, h: 1 };
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.repeat.set(-c.w, c.h);
  tex.offset.set(c.x + c.w, 1 - c.y - c.h);
  tex.needsUpdate = true;
}

function useScreenTexture(tex: Texture, crop?: MediaCrop) {
  useEffect(() => initScreenTexture(tex, crop), [tex, crop]);
}

function ImageScreens({
  url,
  crop,
  children,
}: {
  url: string;
  crop?: MediaCrop;
  children: (tex: Texture) => ReactNode;
}) {
  const tex = useLoader(TextureLoader, url);
  useScreenTexture(tex, crop);
  return <>{children(tex)}</>;
}

/** Screens driven by the playback engine's master video element. */
function EngineVideoScreens({
  video,
  crop,
  children,
}: {
  video: HTMLVideoElement;
  crop?: MediaCrop;
  children: (tex: Texture) => ReactNode;
}) {
  const tex = useMemo(() => new VideoTexture(video), [video]);
  useScreenTexture(tex, crop);
  useEffect(() => () => tex.dispose(), [tex]);
  return <>{children(tex)}</>;
}

/** Screens mirroring the GIF engine's frame canvas. */
function EngineGifScreens({
  engine,
  crop,
  children,
}: {
  engine: GifEngine;
  crop?: MediaCrop;
  children: (tex: Texture) => ReactNode;
}) {
  const tex = useMemo(() => new CanvasTexture(engine.canvas), [engine]);
  useScreenTexture(tex, crop);
  useEffect(() => () => tex.dispose(), [tex]);
  const lastStamp = useRef(-1);
  useFrame(() => {
    if (engine.stamp !== lastStamp.current) {
      lastStamp.current = engine.stamp;
      markTextureDirty(tex);
    }
  });
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

/**
 * Deterministic de-overlap for the per-device text labels. Devices with
 * similar sizes/distances (nested handhelds at 36/40cm) land their name and
 * floor-distance labels on top of each other; this walks the visible set
 * sorted by distance, chain-clusters anchors that fall within roughly a
 * label height of each other, and hands each member a stable offset:
 * names alternate to the left/right rect edge (like the 2D view's corner
 * cycling) and stack upward past pairs; floor labels alternate sides of the
 * drop line and stagger height. Pure and order-stable — recomputed only
 * when devices/scenario/eye height change, never per frame.
 */
function computeLabelPlacements(
  visible: Device[],
  scenario: Scenario,
  eyeH: number,
): Map<string, LabelPlacement> {
  interface Info {
    id: string;
    z: number;
    topY: number;
    halfW: number;
    nameSize: number;
  }
  const infos: Info[] = visible
    .map((d) => {
      const { widthCm, heightCm } = physicalSizeCm(d.diagonalIn, d.aspect);
      const centerY = d.elevation?.[scenario] ?? eyeH;
      return {
        id: d.id,
        z: d.distanceCm,
        // Name-label anchor height (rect top + 3), at the tween's target.
        topY: centerY + heightCm / 2 + 3,
        halfW: widthCm / 2,
        // Mirrors DeviceRect's name font sizing.
        nameSize: Math.min(12, Math.max(4, heightCm * 0.14)),
      };
    })
    .sort((a, b) => a.z - b.z);

  const out = new Map<string, LabelPlacement>();
  for (const i of infos)
    out.set(i.id, { nameX: 0, nameLift: 0, distX: 0, distLift: 0 });

  // Name labels: anchors near each other in the (y, z) plane collide.
  let cluster: Info[] = [];
  const flushNames = () => {
    if (cluster.length > 1) {
      cluster.forEach((m, idx) => {
        const p = out.get(m.id)!;
        p.nameX = (idx % 2 === 0 ? -1 : 1) * m.halfW;
        p.nameLift = Math.floor(idx / 2) * (m.nameSize + 2);
      });
    }
    cluster = [];
  };
  for (const info of infos) {
    const prev = cluster[cluster.length - 1];
    if (
      prev &&
      Math.hypot(info.z - prev.z, info.topY - prev.topY) >
        1.5 * Math.max(prev.nameSize, info.nameSize)
    ) {
      flushNames();
    }
    cluster.push(info);
  }
  flushNames();

  // Floor labels all sit ~5cm above the floor on their drop lines, so only
  // the distance separates them; a "360 cm" readout is ~18cm wide.
  let floor: Info[] = [];
  const flushFloor = () => {
    if (floor.length > 1) {
      floor.forEach((m, idx) => {
        const p = out.get(m.id)!;
        p.distX = (idx % 2 === 0 ? -1 : 1) * 12;
        p.distLift = Math.floor(idx / 2) * 7;
      });
    }
    floor = [];
  };
  for (const info of infos) {
    const prev = floor[floor.length - 1];
    if (prev && info.z - prev.z > 18) flushFloor();
    floor.push(info);
  }
  flushFloor();

  return out;
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
  const activeItem = items.find((i) => i.id === activeId) ?? null;
  // Animated media renders from the shared playback engine (video element
  // or GIF frame canvas); re-resolve when it (re)initializes.
  usePlaybackStore((s) => s.engineNonce);
  const engine = getEngine();
  // For videos the objectUrl is the poster frame — a fallback if the
  // playable URL is somehow missing.
  const imageUrl = activeItem ? objectUrls[activeItem.id] : undefined;
  // Crop: rects letterbox against the effective (cropped) dims; the crop
  // window itself is applied on the shared texture's repeat/offset.
  const mediaCrop = activeItem?.crop;
  const mediaDims = activeItem ? effectiveDims(activeItem) : null;

  const eyeH = eyeHeightCm(scenario, heightCm);
  const farZ = Math.max(100, ...visible.map((d) => d.distanceCm));

  const displayMode = useSettingsStore((s) => s.displayMode);
  const displayFill = useSettingsStore((s) => s.displayFill);

  const labelPlacements = useMemo(
    () => computeLabelPlacements(visible, scenario, eyeH),
    [visible, scenario, eyeH],
  );

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nodeDragging, setNodeDragging] = useState(false);
  const updateThisDevice = useDeviceStore((s) => s.updateThisDevice);
  const updateDevice = useDeviceStore((s) => s.updateDevice);
  const showProjection = useViewerStore((s) => s.showProjectionLines);

  // The GL canvas element, captured in onCreated for the export action.
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const exportPng = () => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    // preserveDrawingBuffer keeps the last rendered frame readable, so this
    // captures the current camera framing as-is.
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wright-angles-3d-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  // The media texture is loaded ONCE here and shared by every rect.
  const rects = (tex: Texture | null) =>
    visible.map((d) => (
      <DeviceRect
        key={d.id}
        device={d}
        centerY={d.elevation?.[scenario] ?? eyeH}
        palette={palette}
        displayFill={displayFill}
        labels={labelPlacements.get(d.id)}
        eyeY={eyeH}
        projectTo={farZ + 5}
        showProjection={showProjection}
        selected={selectedId === d.id}
        onSelect={() =>
          setSelectedId((cur) => (cur === d.id ? null : d.id))
        }
        onDistanceDrag={(distanceCm) =>
          d.id === thisDevice.id
            ? updateThisDevice({ distanceCm })
            : updateDevice(d.id, { distanceCm })
        }
        onDragState={setNodeDragging}
        media={
          tex && mediaDims
            ? { texture: tex, width: mediaDims.width, height: mediaDims.height }
            : null
        }
      />
    ));

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={[1, 2]}
        onPointerMissed={() => setSelectedId(null)}
        // Keep the drawn frame readable so the HUD's "export view" action
        // can capture the canvas as a PNG.
        gl={{ preserveDrawingBuffer: true }}
        camera={{
          position: headOnPose.position,
          fov: headOnPose.fov,
          near: 1,
          far: 20000,
        }}
        onCreated={({ gl, invalidate }) => {
          const el = gl.domElement;
          canvasElRef.current = el;
          // Recover from GPU resets instead of going permanently black.
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
          {activeItem && engine?.kind === "video" ? (
            <EngineVideoScreens video={engine.video} crop={mediaCrop}>
              {rects}
            </EngineVideoScreens>
          ) : activeItem && engine?.kind === "gif" ? (
            <EngineGifScreens engine={engine} crop={mediaCrop}>
              {rects}
            </EngineGifScreens>
          ) : activeItem && imageUrl ? (
            <ImageScreens url={imageUrl} crop={mediaCrop}>
              {rects}
            </ImageScreens>
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
            enabled={!nodeDragging}
            target={orbitPose.target}
            maxPolarAngle={Math.PI / 2 - 0.05}
            maxDistance={farZ * 6}
          />
        ) : null}
      </Canvas>
      <SceneHud onExport={exportPng} />
    </div>
  );
}
