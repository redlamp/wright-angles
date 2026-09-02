"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, TextureLoader, VideoTexture, type Group, type Texture, Raycaster, Ray, type Object3D } from "three";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { getEngine, isAnimatedItem, type GifEngine } from "@/lib/playback-engine";
import { usePlaybackStore } from "@/stores/playback-store";
import type { Device, MediaCrop } from "@/lib/types";
import { formatDistance, physicalSizeCm } from "@/lib/display-math";
import { boxInCrop, cropDims, cropOf, cropsEqual } from "@/lib/media-crop";
import { deviceFitCrop } from "@/lib/fit";
import { deviceViewScale } from "@/lib/view-scale";
import { easeInOutCubic } from "@/lib/easing";
import {
  centerYFor,
  heldGripFor,
  resolvedTiltDeg,
} from "@/lib/viewing-geometry";
import { activeKeyframe } from "@/lib/scan-keyframes";
import { useAnnotationStore } from "@/stores/annotation-store";
import { useDeviceStore } from "@/stores/device-store";
import { useMediaStore } from "@/stores/media-store";
import { useSettingsStore, type DisplayMode } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { eyeHeightCm, useViewerStore, type Scenario } from "@/stores/viewer-store";
import { useSceneTheme } from "@/components/use-theme";
import DeviceRect, {
  NAME_FONT_CM,
  type ContentBox,
  type LabelPlacement,
} from "./device-rect";
import ViewerFigure from "./viewer-figure";
import ScenarioProps from "./scenario-props";
import CameraRig, { type CameraPose } from "./camera-rig";
import PivotOrbit from "./pivot-orbit";
import { useScreenViewport } from "@/components/display-area";
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

/** True when `target` is the first visible mesh along `ray` in its scene. */
function isNearestHit(target: Object3D, ray: Ray): boolean {
  let root: Object3D = target;
  while (root.parent) root = root.parent;
  const rc = new Raycaster();
  rc.ray.copy(ray);
  const hit = rc
    .intersectObjects(root.children, true)
    .find((h) => (h.object as { isMesh?: boolean }).isMesh && isShown(h.object));
  return hit?.object === target;
}

function isShown(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/**
 * Orbit polar-angle bounds (radians from world +Y), shared by OrbitControls
 * (plain drag rotate, pan, zoom) and PivotOrbit (Ctrl+drag rotate about
 * the clicked point) so the two gestures clamp identically. maxPolarAngle keeps the camera from diving
 * under the floor; minPolarAngle keeps it shy of looking straight down.
 */
const MIN_POLAR_ANGLE = 0.05;
const MAX_POLAR_ANGLE = Math.PI / 2 - 0.05;

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
  // useMemo, NOT useEffect: effects run after paint, so a freshly
  // loaded/created texture could render a frame (or more, on a busy
  // main thread) with default repeat/offset — i.e. WITHOUT the
  // U-mirror, which reads as a flipped image from the front (Taylor's
  // "sometimes backwards" bug). Applying during render guarantees the
  // mirror is in place before the first frame samples the texture.
  useMemo(() => initScreenTexture(tex, crop), [tex, crop]);
}

/**
 * Per-device screen textures. The base texture wears the plain media
 * (source) crop; each DISTINCT fit-derived crop gets ONE clone (clones
 * share the pixel upload via texture.source — only repeat/offset differ
 * per Texture object), so N devices on two crops cost two textures, not
 * N. Devices whose fit is a no-op resolve to the base.
 */
interface ScreenTextures {
  forDevice: (deviceId: string) => Texture;
  /** Base + clones — engine-driven screens mark ALL of them dirty. */
  all: Texture[];
}

function useCropTextures(
  base: Texture,
  mediaCrop: MediaCrop | undefined,
  fitCrops: Record<string, MediaCrop> | undefined,
): ScreenTextures {
  useScreenTexture(base, mediaCrop);
  const clones = useMemo(() => {
    const byDevice = new Map<string, Texture>();
    const made: Texture[] = [];
    if (fitCrops) {
      const byKey = new Map<string, Texture>();
      for (const [devId, crop] of Object.entries(fitCrops)) {
        const key = `${crop.x},${crop.y},${crop.w},${crop.h}`;
        let t = byKey.get(key);
        if (!t) {
          t = base.clone();
          initScreenTexture(t, crop);
          byKey.set(key, t);
          made.push(t);
        }
        byDevice.set(devId, t);
      }
    }
    return { byDevice, made };
  }, [base, fitCrops]);
  useEffect(
    () => () => {
      for (const t of clones.made) t.dispose();
    },
    [clones],
  );
  return useMemo(
    () => ({
      forDevice: (deviceId: string) => clones.byDevice.get(deviceId) ?? base,
      all: [base, ...clones.made],
    }),
    [base, clones],
  );
}

function ImageScreens({
  url,
  crop,
  fitCrops,
  children,
}: {
  url: string;
  crop?: MediaCrop;
  fitCrops?: Record<string, MediaCrop>;
  children: (texs: ScreenTextures) => ReactNode;
}) {
  const tex = useLoader(TextureLoader, url);
  const texs = useCropTextures(tex, crop, fitCrops);
  // useCropTextures already disposes its own clones; the BASE texture
  // (r3f's cache, keyed by url) is this component's to dispose — on
  // unmount, and again whenever url changes (the old texture's own
  // cleanup, since `tex` and `url` change together). Clearing the r3f
  // loader cache alongside the dispose stops a later re-visit to the
  // same url handing back an already-disposed texture.
  useEffect(() => {
    return () => {
      tex.dispose();
      useLoader.clear(TextureLoader, url);
    };
  }, [tex, url]);
  return <>{children(texs)}</>;
}

/** Screens driven by the playback engine's master video element. */
function EngineVideoScreens({
  video,
  crop,
  fitCrops,
  children,
}: {
  video: HTMLVideoElement;
  crop?: MediaCrop;
  fitCrops?: Record<string, MediaCrop>;
  children: (texs: ScreenTextures) => ReactNode;
}) {
  const tex = useMemo(() => new VideoTexture(video), [video]);
  const texs = useCropTextures(tex, crop, fitCrops);
  useEffect(() => () => tex.dispose(), [tex]);
  // Demand frameloop: request a render per decoded video frame — no
  // frames while paused, native cadence while playing. (VideoTexture
  // clones each pull the current video frame when rendered, so the
  // per-device textures stay in lockstep without extra marking.)
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
  return <>{children(texs)}</>;
}

/** Screens mirroring the GIF engine's frame canvas. */
function EngineGifScreens({
  engine,
  crop,
  fitCrops,
  children,
}: {
  engine: GifEngine;
  crop?: MediaCrop;
  fitCrops?: Record<string, MediaCrop>;
  children: (texs: ScreenTextures) => ReactNode;
}) {
  const tex = useMemo(() => new CanvasTexture(engine.canvas), [engine]);
  const texs = useCropTextures(tex, crop, fitCrops);
  useEffect(() => () => tex.dispose(), [tex]);
  // Demand frameloop: each decoded GIF frame marks every screen texture
  // (base + per-device clones) dirty and requests exactly one render.
  const invalidate = useThree((s) => s.invalidate);
  useEffect(
    () =>
      engine.subscribe(() => {
        for (const t of texs.all) markTextureDirty(t);
        invalidate();
      }),
    [engine, texs, invalidate],
  );
  return <>{children(texs)}</>;
}

/**
 * Live window inner size. The head-on FOV/pose below read
 * window.innerWidth/innerHeight directly (outside any event this
 * component otherwise subscribes to), so without this they'd go stale
 * the moment the window is resized with nothing else triggering a
 * re-render — subscribing to `resize` is all this hook is for.
 */
function useWindowSize() {
  const [size, setSize] = useState(() =>
    typeof window === "undefined"
      ? { w: 0, h: 0 }
      : { w: window.innerWidth, h: window.innerHeight },
  );
  useEffect(() => {
    const onResize = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

/**
 * Vertical fov that makes the head-on camera see exactly what the 2D view
 * shows in this window: the window height mapped through the 2D scale into
 * device pixels, then through the panel's pixel pitch into physical size,
 * subtended from the viewing distance. This is what makes the 2D↔3D swap
 * land without a visual jump.
 */
function headOnFovDeg(
  thisDevice: Device,
  displayMode: DisplayMode,
  winW: number,
  winH: number,
): number {
  if (typeof window === "undefined" || winW <= 0 || winH <= 0) return 40;
  const res = thisDevice.resolution;
  const k = deviceViewScale(
    res.w,
    res.h,
    winW,
    winH,
    displayMode === "viewport" ? window.screen.width : null,
  );
  if (!k) return 40;
  const visibleDevicePx = winH / k;
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
    /** Rough rendered width of the name, in scene cm. */
    nameW: number;
  }
  const infos: Info[] = visible
    .map((d) => {
      const { widthCm, heightCm } = physicalSizeCm(d.diagonalIn, d.aspect);
      const centerY = centerYFor(d, scenario, eyeH);
      return {
        id: d.id,
        z: d.distanceCm,
        // Name-label anchor height (rect top + 3), at the tween's target.
        topY: centerY + heightCm / 2 + 3,
        halfW: widthCm / 2,
        nameSize: NAME_FONT_CM,
        // Average glyph advance for this face is ~0.55em; close enough to
        // decide overlap without measuring troika's laid-out geometry.
        nameW: d.label.length * NAME_FONT_CM * 0.55,
      };
    })
    .sort((a, b) => a.z - b.z);

  const out = new Map<string, LabelPlacement>();
  for (const i of infos)
    out.set(i.id, { nameX: 0, nameLift: 0, distX: 0, distLift: 0 });

  // Name labels: anchors near each other in the (y, z) plane collide.
  // They separate by STACKING, not by sliding sideways. Parking a name
  // on its own rect edge (±halfW) scaled the offset with panel width, so
  // a 32:9 ultrawide threw its label ~60cm out — twice as far as a 16:9
  // neighbour and visibly detached from the screen it names. Height is
  // also the only stable axis here: every rect is centred on x=0, and
  // the horizontal offset was modulated by camera side, so it collapsed
  // to zero near edge-on and let the labels collide anyway. A lift is
  // applied statically, so the ladder holds through a full orbit.
  let cluster: Info[] = [];
  const GAP = 2;
  const flushNames = () => {
    if (cluster.length > 1) {
      // Need-based, like the floor-label ramp below: each name rises only
      // far enough to clear the one under it, then stops. A fixed
      // idx * step ladder compounded instead — a monitor whose rect
      // already sits well above the handhelds still inherited two rungs
      // of someone else's stack and floated away from its own screen.
      // Cluster is depth-sorted, so the ladder climbs away from the
      // viewer and each name stays centred over the rect it belongs to.
      let prevTop = -Infinity;
      for (const m of cluster) {
        const p = out.get(m.id)!;
        p.nameX = 0;
        // Labels anchor at their BOTTOM on topY, so one occupies
        // [topY + lift, topY + lift + nameSize].
        const lift = Math.max(0, prevTop + GAP - m.topY);
        p.nameLift = lift;
        prevTop = m.topY + lift + m.nameSize;
      }
    }
    cluster = [];
  };
  for (const info of infos) {
    const prev = cluster[cluster.length - 1];
    // Two names clash when their anchors are closer than the names are
    // WIDE — a multiple of font size missed that, so "Steam Deck OLED"
    // and "27″ 1440p Monitor" sat 28cm apart in z and still overlapped
    // by half their length. Every rect is centred on x=0, so the anchor
    // gap is all that keeps them apart.
    if (
      prev &&
      Math.hypot(info.z - prev.z, info.topY - prev.topY) >
        (prev.nameW + info.nameW) / 2
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
  instantEntry = false,
  onExited,
}: {
  exiting?: boolean;
  /** Skip the head-on→orbit entry fly (initial page load in 3D). */
  instantEntry?: boolean;
  onExited?: () => void;
}) {
  // Snapshot: the parent may clear its flag after mount; the rig's
  // mount behavior must not change mid-flight.
  const [instant] = useState(instantEntry);
  const thisDevice = useDeviceStore((s) => s.thisDevice);
  const devices = useDeviceStore((s) => s.devices);
  const scenario = useViewerStore((s) => s.scenario);
  const inputType = useViewerStore((s) => s.inputType);
  const heightCm = useViewerStore((s) => s.heightCm);
  const palette = SCENE_PALETTES[useSceneTheme()];
  // Memoized: the fit-crop and label memos below key off this list, and
  // a fresh array each render would re-clone every screen texture.
  const visible = useMemo(
    () => [thisDevice, ...devices].filter((d) => d.visible),
    [thisDevice, devices],
  );


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
  // Crop: rects letterbox against their RENDERED dims — the media's
  // source crop, reframed by each device's fit mode; the window itself
  // rides each screen texture's repeat/offset (clones when needed).
  const mediaCrop = activeItem?.crop;
  // Only devices whose fit actually reframes get an entry, so a scene
  // of contain panels (the default) still shares one base texture.
  const fitCrops = useMemo(() => {
    if (!activeItem) return undefined;
    const src = cropOf(activeItem);
    const out: Record<string, MediaCrop> = {};
    for (const d of visible) {
      const c = deviceFitCrop(activeItem, d);
      if (!cropsEqual(c, src)) out[d.id] = c;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }, [activeItem, visible]);

  // Measure boxes + the active keyframe's detected lines, mapped into
  // crop space once and drawn on every screen (per-device colors happen
  // in the rect). Selection highlights follow the annotation store.
  const selectedBoxId = useAnnotationStore((s) => s.selectedBoxId);
  const scanColorMode = useAnnotationStore((s) => s.scanColorMode);
  const showTextBoxes = useAnnotationStore((s) => s.showTextBoxes);
  // 3D hover is meaningless once the scene unmounts — a stale value
  // would pin the inspector open (and at full alpha) back in 2D.
  useEffect(
    () => () => useAnnotationStore.getState().setDeviceHover(null),
    [],
  );
  const animatedActive = activeItem ? isAnimatedItem(activeItem) : false;
  const timeSec = usePlaybackStore((s) => (animatedActive ? s.timeSec : 0));
  // Plain computation (no manual memo): it's a handful of array ops and
  // the demand frameloop only renders on real changes anyway — and the
  // react-compiler can memoize it itself where profitable.
  // Entries stay full-image normalized here; each rect maps them
  // through ITS rendered crop below (fit modes differ per device).
  const groupById = new Map<string, number>();
  const boxEntries: {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    hNorm: number;
    text?: string;
  }[] = [];
  if (activeItem && showTextBoxes) {
    const kf =
      animatedActive && activeItem.scanKeyframes
        ? activeKeyframe(activeItem.scanKeyframes, timeSec)
        : null;
    // Group ids come from the persisted scan / keyframe lines so the
    // global Groups color mode carries into the 3D outlines.
    for (const l of activeItem.scan?.lines ?? [])
      if (l.groupId !== undefined) groupById.set(l.id, l.groupId);
    boxEntries.push(
      ...(activeItem.boxes ?? []).map((b) => ({
        ...b,
        hNorm: b.h,
        text: b.label,
      })),
      ...(kf?.lines ?? []).map((l) => {
        if (l.groupId !== undefined) groupById.set(l.id, l.groupId);
        return {
          id: l.id,
          ...l.box,
          hNorm: l.sizePx ? l.sizePx / activeItem.height : l.box.h,
          text: l.text,
        };
      }),
    );
  }
  const boxesFor = (device: Device): ContentBox[] => {
    if (!activeItem || boxEntries.length === 0) return [];
    const crop = deviceFitCrop(activeItem, device);
    const out: ContentBox[] = [];
    for (const e of boxEntries) {
      const rect = boxInCrop(e, crop);
      if (!rect) continue;
      out.push({
        id: e.id,
        rect,
        hMeasure: e.hNorm / crop.h,
        groupId: groupById.get(e.id),
        label: e.text,
        srcPx: Math.round(e.hNorm * activeItem.height),
        hFull: e.hNorm,
      });
    }
    return out;
  };

  const eyeH = eyeHeightCm(scenario, heightCm);

  // Where the figure's hands go in the handheld pose. Memoized because
  // it feeds a pose the figure tweens toward — a fresh object every
  // render would restart the tween on every frame.
  const heldGrip = useMemo(
    () => heldGripFor(visible, scenario, eyeH),
    [visible, scenario, eyeH],
  );
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
  // visible angle so both ends of the transition line up with 2D —
  // winSize keeps it (and headOnX/Y below) in sync across a resize
  // instead of going stale until something else re-renders this.
  const winSize = useWindowSize();
  const fov = useMemo(
    () => headOnFovDeg(thisDevice, displayMode, winSize.w, winSize.h),
    [thisDevice, displayMode, winSize],
  );
  // The flight lands on WHATEVER 2D's framing is (Taylor 2026-08-17):
  // replicate the 2D content-center offset from the window center —
  // pan plus, in screen-locked viewport mode, the monitor-center
  // anchor — and shift the head-on camera laterally by it, converted
  // to cm at This Device's plane. (Camera +x shows content further
  // right, +y further down, matching client-px axes.)
  const panOffset = useUiStore((s) => s.panOffset);
  const displayCenter = useSettingsStore((s) => s.displayCenter);
  const vp = useScreenViewport();
  let headOnX = 0;
  let headOnY = 0;
  if (winSize.w > 0 && winSize.h > 0) {
    const res = thisDevice.resolution;
    const viewportActive = displayMode === "viewport" && vp !== null;
    let dxPx = panOffset.x;
    let dyPx = panOffset.y;
    if (viewportActive && vp && displayCenter === "screen") {
      dxPx += vp.screenW / 2 - vp.clientX - winSize.w / 2;
      dyPx += vp.screenH / 2 - vp.clientY - winSize.h / 2;
    }
    const k = deviceViewScale(
      res.w,
      res.h,
      winSize.w,
      winSize.h,
      viewportActive && vp ? vp.screenW : null,
    );
    if (k > 0) {
      const cmPerCss =
        physicalSizeCm(thisDevice.diagonalIn, thisDevice.aspect).heightCm /
        res.h /
        k;
      headOnX = dxPx * cmPerCss;
      headOnY = dyPx * cmPerCss;
    }
  }
  const headOnPose: CameraPose = {
    position: [headOnX, eyeH + headOnY, 0],
    target: [headOnX, eyeH + headOnY, farZ],
    fov,
  };
  const [controlsOn, setControlsOn] = useState(false);
  // Double-click on the ground flies the camera back to the orbit pose
  // (Taylor 2026-09-02) — the 3D counterpart of 2D's double-click
  // recenter. A counter, so every double-click is a fresh request.
  const [recenter, setRecenter] = useState(0);
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
  /** Press point of the current gesture — click-vs-camera-drag test. */
  const pointerDownAt = useRef<{ x: number; y: number } | null>(null);
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
      // Deferred: revoking synchronously after click() can beat Firefox/
      // Safari to actually starting the download.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  };

  // The media texture is loaded ONCE here; rects share it (or a clone
  // when the device's fit mode derives a different crop).
  const rects = (texs: ScreenTextures | null) =>
    visible.map((d, i) => {
      const dims = activeItem
        ? cropDims(activeItem, deviceFitCrop(activeItem, d))
        : null;
      return (
        <DeviceRect
          key={d.id}
          device={d}
          zBias={i * 0.04}
          centerY={centerYFor(d, scenario, eyeH)}
          tiltDeg={resolvedTiltDeg(
            d,
            scenario,
            centerYFor(d, scenario, eyeH),
            eyeH,
            d.distanceCm,
          )}
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
          contentBoxes={boxesFor(d)}
          selectedBoxId={selectedBoxId}
          boxColorMode={scanColorMode}
          media={
            texs && dims
              ? {
                  texture: texs.forDevice(d.id),
                  width: dims.width,
                  height: dims.height,
                }
              : null
          }
        />
      );
    });

  return (
    <div
      className="relative h-full w-full"
      // Track the press point so empty-space "clicks" that were really
      // camera drags don't clear the selection (same 4px rule as the
      // on-device select in DeviceRect).
      onPointerDownCapture={(e) => {
        pointerDownAt.current = { x: e.clientX, y: e.clientY };
      }}
    >
      <Canvas
        // Render only when something changed: tweens/camera/video/GIF all
        // self-invalidate, and R3F invalidates on React scene commits.
        // On a 240Hz panel the old always-loop redrew a static scene
        // continuously — the single biggest GPU cost in the app.
        frameloop="demand"
        dpr={[1, 1.5]}
        onPointerMissed={(e) => {
          const d = pointerDownAt.current;
          if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
          selectDevice(null);
        }}
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

        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          onDoubleClick={(e) => {
            // Only when the ground is what was actually under the cursor.
            // r3f delivers the event to every handler-bearing object along
            // the ray and lists only those in e.intersections, so a couch
            // or the figure (no handlers) would not block it; raycast the
            // whole scene instead and insist the ground is the nearest.
            if (!controlsOn || !isNearestHit(e.object, e.ray)) return;
            e.stopPropagation();
            setRecenter((n) => n + 1);
          }}
        >
          <planeGeometry args={[4000, 4000]} />
          <meshBasicMaterial color={palette.ground} />
        </mesh>

        {/* Figure-only lighting: every other mesh is unlit, so these
            lights exist purely to shade the figure's forms. */}
        <hemisphereLight args={["#ffffff", "#3a3a44", 1.15]} />
        <directionalLight position={[-140, 220, -90]} intensity={1.3} />
        {/* The figure fades itself on camera proximity to the head, so
            it appears the moment the flight clears the headspace. */}
        <ViewerFigure
          scenario={scenario}
          inputType={inputType}
          heightCm={heightCm}
          palette={palette}
          held={heldGrip}
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
            <EngineVideoScreens
              video={engine.video}
              crop={mediaCrop}
              fitCrops={fitCrops}
            >
              {rects}
            </EngineVideoScreens>
          ) : activeItem && engine?.kind === "gif" ? (
            <EngineGifScreens
              engine={engine}
              crop={mediaCrop}
              fitCrops={fitCrops}
            >
              {rects}
            </EngineGifScreens>
          ) : activeItem && imageUrl ? (
            <ImageScreens
              url={imageUrl}
              crop={mediaCrop}
              fitCrops={fitCrops}
            >
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
          instant={instant}
          onExited={onExited}
          onControlsChange={setControlsOn}
          recenter={recenter}
        />
        {/* Mounted only while the rig is idle so its update loop never
            fights the fly-in/out; on remount it re-syncs from the camera. */}
        {controlsOn ? (
          <>
            <OrbitControls
              makeDefault
              enableDamping
              enabled={!nodeDragging}
              target={orbitPose.target}
              minPolarAngle={MIN_POLAR_ANGLE}
              maxPolarAngle={MAX_POLAR_ANGLE}
              maxDistance={farZ * 6}
              // Wheel zoom homes in on the point under the cursor instead of
              // the fixed target — reads the pointer via the same raycaster
              // OrbitControls already uses for dollying, so it composes with
              // minDistance/maxDistance/enableDamping with no extra wiring.
              zoomToCursor
              // Plain drag rotates about the target as drei always has;
              // Ctrl+drag is intercepted by PivotOrbit below (Taylor
              // 2026-09-02: default orbit is drei, Ctrl pins the click).
            />
            <PivotOrbit
              active={!nodeDragging}
              minPolarAngle={MIN_POLAR_ANGLE}
              maxPolarAngle={MAX_POLAR_ANGLE}
            />
          </>
        ) : null}
      </Canvas>
      <SceneHud onExport={exportPng} />
    </div>
  );
}
