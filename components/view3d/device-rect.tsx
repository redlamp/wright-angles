"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  BackSide,
  BufferAttribute,
  DoubleSide,
  MathUtils,
  type BufferGeometry,
  type Group,
  type Texture,
} from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard, Line, RoundedBox, Text } from "@react-three/drei";
import type { Device } from "@/lib/types";
import type { DisplayFill } from "@/stores/settings-store";
import { physicalSizeCm } from "@/lib/display-math";
import { containFit } from "@/lib/fit";
import { HANDHELD_BODIES } from "@/lib/presets";
import type { ScenePalette } from "./scene-palette";

const SHOW_LABELS = true;

/** Matches the viewer figure's pose tween so stance changes move in sync. */
const TWEEN_S = 0.5;
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Module-level mutator (react-compiler lint forbids property assignment on
 * hook-returned objects inside components). Places everything that depends
 * on the animated center height: the rect group itself, the drop-line group
 * (a unit line anchored at the rect bottom whose scale.y is the drop length
 * to the floor), and the floor label 5cm above the floor.
 */
/**
 * Rect-bottom → floor span for the drop line's scale.y. The epsilon keeps
 * the matrix invertible when the rect bottom sits exactly on the floor;
 * sign is preserved so a below-floor bottom draws upward.
 */
function dropLen(y: number, heightCm: number): number {
  const len = y - heightCm / 2;
  return Math.abs(len) < 1e-3 ? 1e-3 : len;
}

/**
 * Rewrite the 4 eye→corner rays in the rect's local space, extended
 * THROUGH the corners out to `reachZ` (world distance) so the cone
 * visibly lands on the farthest display.
 */
function updateProjection(
  geom: BufferGeometry | null,
  eye: [number, number, number],
  corners: [number, number, number][],
  distCm: number,
  reachZ: number,
) {
  if (!geom) return;
  let attr = geom.getAttribute("position") as BufferAttribute | undefined;
  if (!attr || attr.count !== corners.length * 2) {
    attr = new BufferAttribute(new Float32Array(corners.length * 2 * 3), 3);
    geom.setAttribute("position", attr);
  }
  const a = attr.array as Float32Array;
  corners.forEach((c, i) => {
    const dirX = c[0] - eye[0];
    const dirY = c[1] - eye[1];
    const dirZ = c[2] - eye[2];
    // Local z of the eye is -distCm; scale the ray so its end lands on
    // the reachZ plane (world) = reachZ - distCm (local).
    const k = dirZ > 1e-6 ? reachZ / dirZ : 1;
    const o = i * 6;
    a[o] = eye[0];
    a[o + 1] = eye[1];
    a[o + 2] = eye[2];
    a[o + 3] = eye[0] + dirX * k;
    a[o + 4] = eye[1] + dirY * k;
    a[o + 5] = eye[2] + dirZ * k;
  });
  attr.needsUpdate = true;
}

function applyCenterY(
  rect: Group | null,
  drop: Group | null,
  label: Group | null,
  y: number,
  heightCm: number,
) {
  if (rect) rect.position.y = y;
  if (drop) drop.scale.y = dropLen(y, heightCm);
  // The floor marker (node + flat angled label) sits on the ground.
  if (label) label.position.y = -y + 0.12;
}

/**
 * The active media item's texture, loaded once at scene level and shared by
 * every rect. Width/height are the content's intrinsic pixels (for fit).
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
  palette,
  media,
  displayFill,
  labels,
  eyeY,
  projectTo,
  showProjection,
  selected,
  onSelect,
}: {
  device: Device;
  /** Target screen-center height (cm); the rendered Y tweens toward it. */
  centerY: number;
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
  /** Viewer eye height (cm) — the origin of the projection lines. */
  eyeY: number;
  /** World z the projection rays extend to (the farthest display). */
  projectTo: number;
  /** Show this rect's eye-to-corner projection lines faintly. */
  showProjection?: boolean;
  /** Selected in the scene: projection lines render at full strength. */
  selected?: boolean;
  onSelect?: () => void;
}) {
  const { widthCm, heightCm } = physicalSizeCm(device.diagonalIn, device.aspect);
  const lp = labels ?? ZERO_LABELS;

  // Curvature radius in cm; concave toward the viewer, so the center of
  // curvature sits on the viewer side at local z = -R.
  const R = device.curvatureR ? device.curvatureR / 10 : 0;
  const curved = R > 0;

  const fit = media
    ? containFit(media.width, media.height, widthCm, heightCm)
    : null;

  // Projection endpoints in local space: the IMAGE bounds when media is
  // shown (what the viewer actually attends to), else the panel corners.
  // Curved panels use their actual arc-end corners.
  const projW = fit ? fit.w : widthCm;
  const projH = fit ? fit.h : heightCm;
  const projCorners = useMemo<[number, number, number][]>(() => {
    const hh = projH / 2;
    if (!curved) {
      const hw = projW / 2;
      return [
        [-hw, -hh, 0],
        [hw, -hh, 0],
        [hw, hh, 0],
        [-hw, hh, 0],
      ];
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
    ];
  }, [projW, projH, curved, R, fit]);

  const rectRef = useRef<Group>(null);
  const dropRef = useRef<Group>(null);
  const labelRef = useRef<Group>(null);
  const projRef = useRef<BufferGeometry>(null);

  // Height tween state, same pattern as viewer-figure's pose tween: the
  // live value in a ref, an anim record capturing where the flight started.
  const curY = useRef(centerY);
  const anim = useRef<{ from: number; start: number | null } | null>(null);
  const prevTarget = useRef(centerY);
  useEffect(() => {
    if (prevTarget.current !== centerY) {
      anim.current = { from: curY.current, start: null };
      prevTarget.current = centerY;
    }
  }, [centerY]);

  useFrame((state) => {
    const a = anim.current;
    if (a) {
      if (a.start === null) a.start = state.clock.elapsedTime;
      const t = Math.min(1, (state.clock.elapsedTime - a.start) / TWEEN_S);
      curY.current =
        t >= 1 ? centerY : MathUtils.lerp(a.from, centerY, easeInOutCubic(t));
      if (t >= 1) anim.current = null;
    }
    applyCenterY(
      rectRef.current,
      dropRef.current,
      labelRef.current,
      curY.current,
      heightCm,
    );
    if (showProjection || selected) {
      updateProjection(
        projRef.current,
        [0, eyeY - curY.current, -device.distanceCm],
        projCorners,
        device.distanceCm,
        projectTo,
      );
    }
  });

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

  const body =
    device.show3dBody !== false && device.deviceName
      ? HANDHELD_BODIES[device.deviceName]
      : undefined;

  // Name label scales with the rect so a phone at 36cm doesn't drown in text.
  const nameSize = Math.min(12, Math.max(4, heightCm * 0.14));

  return (
    <group
      ref={rectRef}
      position={[0, centerY, device.distanceCm]}
      onClick={
        onSelect
          ? (e) => {
              e.stopPropagation();
              onSelect();
            }
          : undefined
      }
    >
      <Line
        points={outline}
        color={device.color}
        lineWidth={selected ? 3 : 2}
      />
      {showProjection || selected ? (
        <lineSegments>
          <bufferGeometry ref={projRef} />
          <lineBasicMaterial
            color={device.color}
            transparent
            opacity={selected ? 0.85 : 0.22}
            depthWrite={false}
          />
        </lineSegments>
      ) : null}

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
                image stays visible from behind the device. */}
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
                image stays visible from behind the device. */}
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

      {SHOW_LABELS ? (
        <Billboard position={[lp.nameX, heightCm / 2 + 3 + lp.nameLift, 0]}>
          <Text
            fontSize={nameSize}
            color={device.color}
            anchorX="center"
            anchorY="bottom"
          >
            {device.label}
          </Text>
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
          <Text
            fontSize={5}
            color={device.color}
            anchorX="left"
            anchorY="middle"
            position={[2.5, 0.06, -2.5]}
            rotation={[-Math.PI / 2, 0, -Math.PI / 4]}
          >
            {`${Math.round(device.distanceCm)} cm`}
          </Text>
        </group>
      ) : null}
    </group>
  );
}
