"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  BackSide,
  DoubleSide,
  MathUtils,
  type BufferGeometry,
  type Group,
  type Texture,
} from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Billboard, Line, RoundedBox, Text } from "@react-three/drei";
import type { Device } from "@/lib/types";
import type { DisplayFill } from "@/stores/settings-store";
import { physicalSizeCm } from "@/lib/display-math";
import { fitBox, fitModeOf } from "@/lib/fit";
import { easeInOutCubic } from "@/lib/easing";
import { degToRad } from "@/lib/viewing-geometry";
import { FEATURE_3D_DEVICE_BODY } from "@/lib/flags";
import { HANDHELD_BODIES } from "@/lib/presets";
import type { ScenePalette } from "./scene-palette";
import {
  SHOW_LABELS,
  setDeviceHover,
  FONT_URL,
  TWEEN_S,
  dropLen,
  updateProjection,
  applyLabelLift,
  setBodyCursor,
  raiseDistLabel,
  raiseNameLabel,
  applyNameOffset,
  applyCenterY,
  NAME_FONT_CM,
} from "./device-rect-helpers";
import DeviceContentBoxes from "./device-rect-content-boxes";

export { NAME_FONT_CM };

/**
 * The active media item's texture, loaded once at scene level and shared by
 * every rect. Width/height are the content's EFFECTIVE pixels — the crop
 * window when one is set, else intrinsic — so letterbox fit matches what
 * the texture's repeat/offset actually shows (see initScreenTexture).
 */
export interface ScreenMedia {
  texture: Texture;
  width: number;
  height: number;
}

/**
 * De-overlap offsets for this device's two text labels, computed once in
 * scene-view from all visible devices (it knows the whole set; this
 * component only knows itself). All values are cm; zeros = the default
 * centered placement.
 */
/**
 * A measure box / detected line shown ON the 3D screens, in crop-space
 * coordinates (already passed through boxInCrop by scene-view).
 */
export interface ContentBox {
  id: string;
  rect: { x: number; y: number; w: number; h: number };
  /** Crop-relative height used for the per-device legibility color. */
  hMeasure: number;
  /** Text block id — used when the global color mode is "group". */
  groupId?: number;
  /** OCR text / user label, for the 3D hover details. */
  label?: string;
  /** Source pixel height (group-corrected where available). */
  srcPx: number;
  /** Full-image normalized measure height (pre-crop), for metrics. */
  hFull: number;
}

export interface LabelPlacement {
  /** Name billboard: x anchor offset (± rect half-width) + extra lift. */
  nameX: number;
  nameLift: number;
  /** Floor distance label: side offset off the drop line + height stagger. */
  distX: number;
  distLift: number;
}

const ZERO_LABELS: LabelPlacement = { nameX: 0, nameLift: 0, distX: 0, distLift: 0 };

/**
 * One device drawn true-to-scale (1 unit = 1cm): an outlined rect facing the
 * viewer at its viewing distance, centered at `centerY` (resolved by the
 * parent from the device's per-scenario elevation or the viewer's eye
 * height), plus a drop line to the floor with the distance readout.
 * Rotation stays face-on even when off the sight line — elevation is scene
 * realism, not gaze math.
 *
 * When `centerY` changes (stance change, elevation edit) the rect group's Y
 * tweens toward it (~0.5s ease in-out, matching the figure's pose tween)
 * imperatively in useFrame — retargetable mid-flight, no setState per
 * frame. The drop line and its floor label track the moving rect.
 *
 * Screens with curvatureR render as a cylinder segment (radius R, arc length
 * = physical width) concave toward the viewer. All screen surfaces face +Z,
 * so the viewer at -Z sees their back faces; the shared texture is mirrored
 * in U once at load time to compensate (see scene-view).
 */
export default function DeviceRect({
  device,
  centerY,
  poseKey,
  distLabel,
  palette,
  media,
  displayFill,
  labels,
  eyeYRef,
  projectTo,
  showProjection,
  selected,
  onSelect,
  onDistanceDrag,
  onDragState,
  contentBoxes,
  selectedBoxId,
  boxColorMode = "rating",
  zBias,
  tiltDeg,
}: {
  device: Device;
  /** Target screen-center height (cm); the rendered Y tweens toward it. */
  centerY: number;
  /**
   * Panel pitch in degrees, positive tipping the face up (top edge away
   * from the viewer). Resolved in scene-view, which knows the stance and
   * eye height; this component stays store-free.
   */
  tiltDeg?: number;
  /**
   * Changes when the stance does; a centerY change WITH a poseKey change
   * tweens, one without (the height slider) snaps.
   */
  poseKey?: string;
  /**
   * Pre-formatted distance readout in the user's unit (this component
   * stays store-free); falls back to whole centimeters.
   */
  distLabel?: string;
  palette: ScenePalette;
  media?: ScreenMedia | null;
  /**
   * Empty-device fill setting, passed down from scene-view (this component
   * stays store-free). Mirrors the 2D view: "device-color" fills the empty
   * panel — and backs the letterbox bars behind media — with device.color
   * instead of black.
   */
  displayFill: DisplayFill;
  /** Label de-overlap offsets from scene-view; omitted = centered. */
  labels?: LabelPlacement;
  /**
   * Live (tweened) viewer eye height — the origin of the projection
   * lines; a ref so it glides with the figure without re-renders.
   */
  eyeYRef: React.MutableRefObject<number>;
  /** World z the projection rays extend to (the farthest display). */
  projectTo: number;
  /** Show this rect's eye-to-corner projection lines faintly. */
  showProjection?: boolean;
  /** Selected in the scene: projection lines render at full strength. */
  selected?: boolean;
  onSelect?: () => void;
  /** Live distance while the floor node is dragged along the floor. */
  onDistanceDrag?: (distanceCm: number) => void;
  /** Reports node-drag start/end so the parent can pause OrbitControls. */
  onDragState?: (dragging: boolean) => void;
  /** Measure boxes + active-keyframe lines drawn on the screen. */
  contentBoxes?: ContentBox[];
  /** App-wide selected box for the white highlight. */
  selectedBoxId?: string | null;
  /** Global scan color mode: block tints vs per-device verdict bands. */
  boxColorMode?: "group" | "rating";
  /** Sub-millimeter z stagger against same-distance devices. */
  zBias?: number;
}) {
  const { widthCm, heightCm } = physicalSizeCm(device.diagonalIn, device.aspect);
  const lp = labels ?? ZERO_LABELS;

  // Curvature radius in cm; concave toward the viewer, so the center of
  // curvature sits on the viewer side at local z = -R.
  const R = device.curvatureR ? device.curvatureR / 10 : 0;
  const curved = R > 0;

  // Where the content quad sits on this panel, in cm. Under `stretch`
  // it IS the panel (widthCm × heightCm) — the content boxes and the
  // projection rays below are all measured off this, so they follow.
  const fit = media
    ? fitBox(fitModeOf(device), media.width, media.height, widthCm, heightCm)
    : null;

  // Projection endpoints in local space: the IMAGE bounds when media is
  // shown (what the viewer actually attends to), else the panel corners.
  // Curved panels use their actual arc-end corners.
  const projW = fit ? fit.w : widthCm;
  const projH = fit ? fit.h : heightCm;
  const tiltRad = degToRad(tiltDeg ?? 0);
  const projCorners = useMemo<[number, number, number][]>(() => {
    const hh = projH / 2;
    // The panel's own group carries the pitch, but the cone does not
    // live in that group (its rays start at the eye), so the corners
    // are pitched here instead — same rotation about +X, by hand.
    const cos = Math.cos(tiltRad);
    const sin = Math.sin(tiltRad);
    const pitch = (c: [number, number, number]): [number, number, number] => [
      c[0],
      c[1] * cos - c[2] * sin,
      c[1] * sin + c[2] * cos,
    ];
    if (!curved) {
      const hw = projW / 2;
      return [
        [-hw, -hh, 0],
        [hw, -hh, 0],
        [hw, hh, 0],
        [-hw, hh, 0],
      ].map((c) => pitch(c as [number, number, number]));
    }
    // Content sits on a slightly smaller radius than the outline.
    const r = fit ? R - 0.25 : R;
    const arc = projW / r;
    const x = r * Math.sin(arc / 2);
    const z = -R + r * Math.cos(arc / 2);
    return [
      [-x, -hh, z],
      [x, -hh, z],
      [x, hh, z],
      [-x, hh, z],
    ].map((c) => pitch(c as [number, number, number]));
  }, [projW, projH, curved, R, fit, tiltRad]);

  const rectRef = useRef<Group>(null);
  const dropRef = useRef<Group>(null);
  const labelRef = useRef<Group>(null);
  const projRef = useRef<BufferGeometry>(null);

  // Height tween state, same pattern as viewer-figure's pose tween: the
  // live value in a ref, an anim record capturing where the flight started.
  const curY = useRef(centerY);
  const anim = useRef<{ from: number; start: number | null } | null>(null);
  const prevTarget = useRef(centerY);
  const prevPoseKey = useRef(poseKey);
  useEffect(() => {
    if (prevTarget.current !== centerY) {
      // Tween when the stance (poseKey) changed; height-slider edits
      // snap so the rect tracks the drag without trailing it.
      if (prevPoseKey.current !== poseKey) {
        anim.current = { from: curY.current, start: null };
      } else {
        anim.current = null;
        curY.current = centerY;
      }
      prevTarget.current = centerY;
    }
    prevPoseKey.current = poseKey;
  }, [centerY, poseKey]);

  // setBodyCursor writes to document.body, outside this component's own
  // DOM — if it unmounts (device removed, media changes the tree) mid
  // hover/drag, nothing else clears that cursor back to normal.
  useEffect(() => {
    return () => setBodyCursor("");
  }, []);

  useFrame((state) => {
    const a = anim.current;
    if (a) {
      if (a.start === null) a.start = state.clock.elapsedTime;
      const t = Math.min(1, (state.clock.elapsedTime - a.start) / TWEEN_S);
      curY.current =
        t >= 1 ? centerY : MathUtils.lerp(a.from, centerY, easeInOutCubic(t));
      if (t >= 1) anim.current = null;
      // Keep frames coming while the height tweens (demand frameloop).
      state.invalidate();
    }
    applyCenterY(
      rectRef.current,
      dropRef.current,
      labelRef.current,
      curY.current,
      heightCm,
    );
    applyLabelLift(
      distLiftRef.current,
      lp.distLift,
      state.camera,
      device.distanceCm,
    );
    applyNameOffset(
      nameOffsetRef.current,
      lp.nameX,
      state.camera,
      device.distanceCm,
    );
    if (showProjection || selected) {
      updateProjection(
        projRef.current,
        [0, eyeYRef.current - curY.current, -device.distanceCm],
        projCorners,
        device.distanceCm,
        projectTo,
      );
    }
  });

  // Shared by the node's hit sphere AND the distance text, so both drag
  // the viewing distance and both advertise it: open hand on hover,
  // closed fist while dragging. The grab cursor is a promise — anything
  // showing it must actually drag.
  const dragHandlers = onDistanceDrag
    ? {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setBodyCursor("grab");
        },
        onPointerOut: (e: ThreeEvent<PointerEvent>) => {
          // Keep the fist while a captured drag passes outside the target.
          if (!(e.target as Element).hasPointerCapture?.(e.pointerId)) {
            setBodyCursor("");
          }
        },
        onPointerDown: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          (e.target as Element).setPointerCapture(e.pointerId);
          onDragState?.(true);
          setBodyCursor("grabbing");
        },
        onPointerMove: (e: ThreeEvent<PointerEvent>) => {
          if (!(e.target as Element).hasPointerCapture?.(e.pointerId)) {
            return;
          }
          // Project the pointer ray onto the floor plane (y = 0);
          // its world z IS the new viewing distance.
          const t = -e.ray.origin.y / e.ray.direction.y;
          if (t > 0) {
            const z = e.ray.origin.z + e.ray.direction.z * t;
            onDistanceDrag(Math.round(Math.min(9999, Math.max(10, z))));
          }
        },
        onPointerUp: (e: ThreeEvent<PointerEvent>) => {
          (e.target as Element).releasePointerCapture?.(e.pointerId);
          onDragState?.(false);
          // Back to the open hand; if the pointer ended off-target, the
          // pointerout that follows the release clears it entirely.
          setBodyCursor("grab");
        },
        onClick: (e: ThreeEvent<MouseEvent>) => e.stopPropagation(),
      }
    : null;

  const outline = useMemo<[number, number, number][]>(() => {
    const hw = widthCm / 2;
    const hh = heightCm / 2;
    if (!curved) {
      return [
        [-hw, -hh, 0],
        [hw, -hh, 0],
        [hw, hh, 0],
        [-hw, hh, 0],
        [-hw, -hh, 0],
      ];
    }
    // Arc sampled so the outline hugs the curved surface; arc length is the
    // physical width, matching the angular math in display-math.
    const N = 24;
    const arc = widthCm / R;
    const pt = (t: number): [number, number] => {
      const th = (t - 0.5) * arc;
      return [R * Math.sin(th), -R + R * Math.cos(th)];
    };
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= N; i++) {
      const [x, z] = pt(i / N);
      pts.push([x, -hh, z]);
    }
    for (let i = N; i >= 0; i--) {
      const [x, z] = pt(i / N);
      pts.push([x, hh, z]);
    }
    pts.push(pts[0]);
    return pts;
  }, [widthCm, heightCm, curved, R]);

  // Letterbox backing behind media content, matching the 2D view's fill.
  const backing = displayFill === "device-color" ? device.color : "#000000";

  const shownDistLabel = distLabel ?? `${Math.round(device.distanceCm)} cm`;
  const distLiftRef = useRef<Group>(null);
  const nameOffsetRef = useRef<Group>(null);

  const body =
    FEATURE_3D_DEVICE_BODY && device.show3dBody !== false && device.deviceName
      ? HANDHELD_BODIES[device.deviceName]
      : undefined;

  const nameSize = NAME_FONT_CM;

  return (
    <group
      ref={rectRef}
      // zBias staggers co-planar screens by well under a millimeter so
      // two devices at the SAME distance never z-fight; far too small
      // to read as a distance change.
      position={[0, centerY, device.distanceCm + (zBias ?? 0)]}
      // Device hover feeds the inspector (full alpha + live details).
      onPointerOver={(e) => {
        e.stopPropagation();
        setDeviceHover({ deviceId: device.id, box: null });
      }}
      onPointerOut={() => setDeviceHover(null)}
      onClick={
        onSelect
          ? (e) => {
              e.stopPropagation();
              // Select on RELEASE of a stationary click only — past a
              // 4px drag it was a camera move, not a selection (same
              // threshold as the 2D view). R3F's delta is the pixel
              // distance between pointerdown and pointerup.
              if (e.delta > 4) return;
              onSelect();
            }
          : undefined
      }
    >
      {/* Everything that is PART OF THE PANEL pitches together: outline,
          chassis, content and the box overlays measured off it. The
          projection cone, the name, the drop line and the floor readout
          stay in untilted space — the cone's rays start at the eye (a
          point in this group's frame, which a rotation would move), and
          the rest are readouts about the panel rather than parts of it.
          projCorners is pitched arithmetically instead, so the rays
          still land on the panel's real corners. */}
      <group rotation={[tiltRad, 0, 0]}>
      <Line
        points={outline}
        color={device.color}
        lineWidth={selected ? 3 : 2}
      />

      {body ? (
        // Full chassis behind the screen so device-vs-screen size reads.
        <RoundedBox
          args={[body.bodyWCm, body.bodyHCm, body.depthCm]}
          radius={Math.min(0.6, body.depthCm / 2 - 0.05)}
          position={[0, 0, body.depthCm / 2 + 0.05]}
        >
          <meshBasicMaterial color={palette.handheldBody} />
        </RoundedBox>
      ) : null}

      {media && fit ? (
        curved ? (
          <group position={[0, 0, -R]}>
            {/* Letterbox backing, a hair inside the outline's arc. */}
            {/* Backing renders viewer-side only so the content's mirror
                image stays visible from behind the device (double-sided
                screens are intentional — Taylor). */}
            <mesh>
              <cylinderGeometry
                args={[R - 0.1, R - 0.1, heightCm, 48, 1, true,
                  -widthCm / (R - 0.1) / 2, widthCm / (R - 0.1)]}
              />
              <meshBasicMaterial color={backing} side={BackSide} toneMapped={false} />
            </mesh>
            <mesh>
              <cylinderGeometry
                args={[R - 0.25, R - 0.25, fit.h, 48, 1, true,
                  -fit.w / (R - 0.25) / 2, fit.w / (R - 0.25)]}
              />
              <meshBasicMaterial map={media.texture} side={DoubleSide} toneMapped={false} />
            </mesh>
          </group>
        ) : (
          <>
            {/* Backing renders viewer-side only so the content's mirror
                image stays visible from behind the device (double-sided
                screens are intentional — Taylor). */}
            <mesh position={[0, 0, -0.15]}>
              <planeGeometry args={[widthCm, heightCm]} />
              <meshBasicMaterial color={backing} side={BackSide} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0, -0.3]}>
              <planeGeometry args={[fit.w, fit.h]} />
              <meshBasicMaterial map={media.texture} side={DoubleSide} toneMapped={false} />
            </mesh>
          </>
        )
      ) : (
        /* Empty panel: solid key-color fill when the setting asks for it,
           else a faint fill so nested rects still read where outlines
           overlap. depthWrite stays off either way so nesting never
           z-fights. */
        <mesh position={curved ? [0, 0, -R] : [0, 0, 0]}>
          {curved ? (
            <cylinderGeometry
              args={[R, R, heightCm, 48, 1, true, -widthCm / R / 2, widthCm / R]}
            />
          ) : (
            <planeGeometry args={[widthCm, heightCm]} />
          )}
          <meshBasicMaterial
            color={device.color}
            transparent
            opacity={displayFill === "device-color" ? 0.9 : 0.06}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Measure boxes / detected lines ON this screen, colored by THIS
          device's legibility verdict — the same text can be green on
          the TV and red on the handheld. */}
      {media && fit && contentBoxes && contentBoxes.length > 0 ? (
        <DeviceContentBoxes
          contentBoxes={contentBoxes}
          media={media}
          fit={fit}
          device={device}
          selectedBoxId={selectedBoxId}
          boxColorMode={boxColorMode}
          curved={curved}
          R={R}
          rectRef={rectRef}
          widthCm={widthCm}
          heightCm={heightCm}
        />
      ) : null}
      </group>

      {showProjection || selected ? (
        // Overlay treatment like the distance markers/labels: no depth
        // test plus a late renderOrder, so scene props (the desk) never
        // occlude the rays — but still below the labels at 15/20.
        <lineSegments renderOrder={10}>
          <bufferGeometry ref={projRef} />
          <lineBasicMaterial
            color={device.color}
            transparent
            opacity={selected ? 0.85 : 0.22}
            depthWrite={false}
            depthTest={false}
          />
        </lineSegments>
      ) : null}

      {SHOW_LABELS ? (
        <Billboard position={[0, heightCm / 2 + 3 + lp.nameLift, 0]}>
          {/* Registration-point clip (same model as the distance
              labels): the horizontal de-collision offset lives on this
              inner group and flips with the camera side per frame, so
              nested rects' names keep a stable side relative to the
              viewer instead of crossing over. */}
          <group ref={nameOffsetRef} position={[lp.nameX, 0, 0]}>
            <Text
              font={FONT_URL}
              fontSize={nameSize}
              color={device.color}
              anchorX="center"
              anchorY="bottom"
              outlineColor="#000000"
              outlineOpacity={0.5}
              outlineOffsetX="3%"
              outlineOffsetY="3%"
              onSync={raiseNameLabel}
            >
              {device.label}
            </Text>
          </group>
        </Billboard>
      ) : null}

      {/* Unit-length drop line anchored at the rect bottom; applyCenterY
          scales it down to the floor as the rect animates. lineWidth is in
          screen px, so scale.y doesn't fatten it. */}
      <group
        ref={dropRef}
        position={[0, -heightCm / 2, 0]}
        scale={[1, dropLen(centerY, heightCm), 1]}
      >
        <Line
          points={[
            [0, 0, 0],
            [0, -1, 0],
          ]}
          color={device.color}
          lineWidth={1}
          transparent
          opacity={0.45}
        />
      </group>
      {SHOW_LABELS ? (
        /* Floor marker: a small node where the drop line lands, with the
           distance laid flat on the ground at 45° (spreadsheet-header
           style) — parallel diagonals never collide. */
        <group ref={labelRef} position={[0, -centerY + 0.12, 0]}>
          <mesh position={[0, 1.2, 0]}>
            <sphereGeometry args={[1.4, 16, 12]} />
            <meshBasicMaterial color={device.color} />
          </mesh>
          {/* Oversized invisible hit target: the node doubles as a drag
              handle for the viewing distance along the sight line. */}
          {dragHandlers ? (
            <mesh position={[0, 1.2, 0]} {...dragHandlers}>
              <sphereGeometry args={[5, 8, 6]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          ) : null}
          {/* Per Taylor's markup (2026-08-15 screenshots): the label
              hangs just below-right of the node, sloping 30° south-east
              in screen space, text reading along the slope. Parallel
              diagonals keep neighbors legible; static offsets only. */}
          {/* Flash model: a clip whose registration point (text left
              edge, vertical center) anchors ON the node; the 30° slope
              rotates about that point. De-collision moves the text's
              local Y inside the rotated clip, so neighboring parallel
              labels separate perpendicular to the slope with an even
              buffer. */}
          <Billboard position={[0, 1.2, 0]}>
            <group rotation={[0, 0, -Math.PI / 6]}>
              {/* Inner clip: per-frame camera-aware lift (applyLabelLift). */}
              <group ref={distLiftRef} position={[0, lp.distLift, 0]}>
                <Text
                  font={FONT_URL}
                  fontSize={5}
                  color={device.color}
                  anchorX="left"
                  anchorY="middle"
                  position={[6, 0, 0]}
                  outlineColor="#000000"
                  outlineOpacity={0.5}
                  outlineOffsetX="3%"
                  outlineOffsetY="3%"
                  onSync={raiseDistLabel}
                  {...(dragHandlers ?? {})}
                >
                  {shownDistLabel}
                </Text>
              </group>
            </group>
          </Billboard>
        </group>
      ) : null}
    </group>
  );
}
