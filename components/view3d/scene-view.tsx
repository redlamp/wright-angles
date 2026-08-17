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
  type Group,
  type Texture,
} from "three";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { getEngine, isAnimatedItem, type GifEngine } from "@/lib/playback-engine";
import { usePlaybackStore } from "@/stores/playback-store";
import type { Device, MediaCrop } from "@/lib/types";
import { formatDistance, physicalSizeCm } from "@/lib/display-math";
import { boxInCrop, cropOf, effectiveDims } from "@/lib/media-crop";
import { activeKeyframe } from "@/lib/scan-keyframes";
import { useAnnotationStore } from "@/stores/annotation-store";
import { useDeviceStore } from "@/stores/device-store";
import { useMediaStore } from "@/stores/media-store";
import { useSettingsStore, type DisplayMode } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { eyeHeightCm, useViewerStore, type Scenario } from "@/stores/viewer-store";
import { useSceneTheme } from "@/lib/use-theme";
import DeviceRect, {
  type ContentBox,
  type LabelPlacement,
} from "./device-rect";
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
  // Demand frameloop: request a render per decoded video frame — no
  // frames while paused, native cadence while playing.
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let handle = 0;
    let alive = true;
    const onFrame = () => {
      if (!alive) return;
      invalidate();
      handle = video.requestVideoFrameCallback(onFrame);
    };
    handle = video.requestVideoFrameCallback(onFrame);
    return () => {
      alive = false;
      video.cancelVideoFrameCallback(handle);
    };
  }, [video, invalidate]);
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
  // Demand frameloop: each decoded GIF frame marks the texture dirty and
  // requests exactly one render.
  const invalidate = useThree((s) => s.invalidate);
  useEffect(
    () =>
      engine.subscribe(() => {
        markTextureDirty(tex);
        invalidate();
      }),
    [engine, tex, invalidate],
  );
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
  // Floor labels: need-based ramp. Each label sums pairwise pressure
  // from neighbors within RANGE — zero when clear, growing linearly as
  // the gap closes. Nearer-than-neighbor pushes down (negative),
  // farther pushes up, so isolated labels sit exactly on their node
  // and crowded ones separate only as much as they must. The sign is
  // re-oriented per frame from the camera side (device-rect).
  const RANGE = 25;
  const MAX_LIFT = 4;
  for (const a of infos) {
    let need = 0;
    for (const b of infos) {
      if (a === b) continue;
      const gap = Math.abs(a.z - b.z);
      if (gap < RANGE) {
        need += (a.z < b.z ? -1 : 1) * (1 - gap / RANGE);
      }
    }
    const p = out.get(a.id)!;
    p.distX = 0;
    p.distLift = Math.max(-1.6, Math.min(1.6, need)) * MAX_LIFT;
  }

  return out;
}

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Module-level so the react-compiler lint permits the mutation. */
function applySightY(group: Group | null, y: number) {
  if (group) group.position.y = y;
}

/**
 * Tweens the shared eye height toward its target in sync with the
 * figure's pose tween (same 0.5s ease), moving the sight line and
 * feeding every rect's projection origin via the shared ref.
 */
function EyeTween({
  target,
  scenario,
  eyeRef,
  sightRef,
}: {
  target: number;
  scenario: Scenario;
  eyeRef: React.MutableRefObject<number>;
  sightRef: React.RefObject<Group | null>;
}) {
  const anim = useRef<{ from: number; start: number | null } | null>(null);
  const prev = useRef(target);
  const prevScenario = useRef(scenario);
  useEffect(() => {
    if (prev.current !== target) {
      // Tween on stance changes only; height-slider edits snap so the
      // sight line and projections track the drag without lag.
      if (prevScenario.current !== scenario) {
        anim.current = { from: eyeRef.current, start: null };
      } else {
        anim.current = null;
        eyeRef.current = target;
      }
      prev.current = target;
    }
    prevScenario.current = scenario;
  }, [target, scenario, eyeRef]);
  useFrame((state) => {
    const a = anim.current;
    if (a) {
      if (a.start === null) a.start = state.clock.elapsedTime;
      const t = Math.min(1, (state.clock.elapsedTime - a.start) / 0.5);
      eyeRef.current =
        t >= 1
          ? target
          : a.from + (target - a.from) * easeInOutCubic(t);
      if (t >= 1) anim.current = null;
      state.invalidate();
    }
    applySightY(sightRef.current, eyeRef.current);
  });
  return null;
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
  const inputType = useViewerStore((s) => s.inputType);
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

  // Measure boxes + the active keyframe's detected lines, mapped into
  // crop space once and drawn on every screen (per-device colors happen
  // in the rect). Selection highlights follow the annotation store.
  const selectedBoxId = useAnnotationStore((s) => s.selectedBoxId);
  const animatedActive = activeItem ? isAnimatedItem(activeItem) : false;
  const timeSec = usePlaybackStore((s) => (animatedActive ? s.timeSec : 0));
  // Plain computation (no manual memo): it's a handful of array ops and
  // the demand frameloop only renders on real changes anyway — and the
  // react-compiler can memoize it itself where profitable.
  const contentBoxes: ContentBox[] = [];
  if (activeItem) {
    const crop = cropOf(activeItem);
    const kf =
      animatedActive && activeItem.scanKeyframes
        ? activeKeyframe(activeItem.scanKeyframes, timeSec)
        : null;
    const entries = [
      ...(activeItem.boxes ?? []).map((b) => ({ ...b, hNorm: b.h })),
      ...(kf?.lines ?? []).map((l) => ({
        id: l.id,
        ...l.box,
        hNorm: l.sizePx ? l.sizePx / activeItem.height : l.box.h,
      })),
    ];
    for (const e of entries) {
      const rect = boxInCrop(e, crop);
      if (!rect) continue;
      contentBoxes.push({ id: e.id, rect, hMeasure: e.hNorm / crop.h });
    }
  }

  const eyeH = eyeHeightCm(scenario, heightCm);
  const farZ = Math.max(100, ...visible.map((d) => d.distanceCm));

  const displayMode = useSettingsStore((s) => s.displayMode);
  const displayFill = useSettingsStore((s) => s.displayFill);
  const unit = useSettingsStore((s) => s.unit);

  const labelPlacements = useMemo(
    () => computeLabelPlacements(visible, scenario, eyeH),
    [visible, scenario, eyeH],
  );

  // Orbit framing captured once; OrbitControls owns the camera after entry.
  // Framed so the vertical span (floor labels → screen tops) centers:
  // lower camera and a floor-ward target keep labels off the bottom
  // edge without dead sky above.
  const [orbitPose] = useState<CameraPose>(() => ({
    position: [-farZ * 1.7, eyeH * 0.7 + farZ * 0.55, -farZ * 0.45],
    target: [0, eyeH * 0.5, farZ * 0.55],
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
  // App-wide selection (shared with the comparison table and 2D view).
  const selectedId = useUiStore((s) => s.selectedDeviceId);
  const selectDevice = useUiStore((s) => s.selectDevice);
  const [nodeDragging, setNodeDragging] = useState(false);
  // Live (tweened) eye height shared by the sight line and every rect's
  // projection origin, so they glide with the figure on stance changes.
  const liveEye = useRef(eyeH);
  const sightRef = useRef<Group>(null);
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
        poseKey={scenario}
        distLabel={formatDistance(d.distanceCm, unit)}
        palette={palette}
        displayFill={displayFill}
        labels={labelPlacements.get(d.id)}
        eyeYRef={liveEye}
        projectTo={farZ + 5}
        showProjection={showProjection}
        selected={selectedId === d.id}
        onSelect={() => selectDevice(selectedId === d.id ? null : d.id)}
        onDistanceDrag={(distanceCm) =>
          d.id === thisDevice.id
            ? updateThisDevice({ distanceCm })
            : updateDevice(d.id, { distanceCm })
        }
        onDragState={setNodeDragging}
        contentBoxes={contentBoxes}
        selectedBoxId={selectedBoxId}
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
        // Render only when something changed: tweens/camera/video/GIF all
        // self-invalidate, and R3F invalidates on React scene commits.
        // On a 240Hz panel the old always-loop redrew a static scene
        // continuously — the single biggest GPU cost in the app.
        frameloop="demand"
        dpr={[1, 1.5]}
        onPointerMissed={() => selectDevice(null)}
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

        {/* Figure-only lighting: every other mesh is unlit, so these
            lights exist purely to shade the figure's forms. */}
        <hemisphereLight args={["#ffffff", "#3a3a44", 1.15]} />
        <directionalLight position={[-140, 220, -90]} intensity={1.3} />
        <ViewerFigure
          scenario={scenario}
          inputType={inputType}
          heightCm={heightCm}
          palette={palette}
        />
        <ScenarioProps
          scenario={scenario}
          inputType={inputType}
          palette={palette}
        />

        <EyeTween
          target={eyeH}
          scenario={scenario}
          eyeRef={liveEye}
          sightRef={sightRef}
        />
        <group ref={sightRef} position={[0, eyeH, 0]}>
          <Line
            points={[
              [0, 0, 0],
              [0, 0, farZ + 80],
            ]}
            color={palette.sight}
            lineWidth={1.5}
            dashed
            dashSize={6}
            gapSize={5}
          />
        </group>

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
