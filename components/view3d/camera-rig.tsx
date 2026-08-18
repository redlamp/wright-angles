"use client";

import { useEffect, useRef } from "react";
import { Vector3, type PerspectiveCamera } from "three";
import { useFrame, useThree } from "@react-three/fiber";

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
  /** Vertical fov (deg). Head-on matches the 2D view's visible angle. */
  fov: number;
}

const ENTER_S = 1.1;
const EXIT_S = 0.9;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Module-level so the react-compiler lint permits the camera mutation. */
function applyFov(camera: unknown, fov: number) {
  const pc = camera as PerspectiveCamera;
  pc.fov = fov;
  pc.updateProjectionMatrix();
}

interface Anim {
  mode: "enter" | "exit";
  fromPos: Vector3;
  fromTarget: Vector3;
  toPos: Vector3;
  toTarget: Vector3;
  fromFov: number;
  toFov: number;
  /** Set on the first animated frame so tab-hidden mounts don't skip ahead. */
  start: number | null;
  duration: number;
}

/**
 * Flies the camera between the head-on pose (eye point looking down +Z,
 * matching the 2D overlay's framing) and the 3/4 orbit pose. Reports when
 * OrbitControls may own the camera via onControlsChange; interruptions
 * restart from wherever the camera currently is.
 */
export default function CameraRig({
  orbitPose,
  headOnPose,
  exiting,
  instant,
  onExited,
  onControlsChange,
}: {
  orbitPose: CameraPose;
  headOnPose: CameraPose;
  exiting: boolean;
  /** Start AT the orbit pose (initial page load in 3D) — no entry fly. */
  instant?: boolean;
  onExited?: () => void;
  onControlsChange: (enabled: boolean) => void;
}) {
  const camera = useThree((s) => s.camera);
  const get = useThree((s) => s.get);

  const poses = useRef({ orbitPose, headOnPose });
  useEffect(() => {
    poses.current = { orbitPose, headOnPose };
  }, [orbitPose, headOnPose]);

  const anim = useRef<Anim | null>(null);
  const lookTarget = useRef(new Vector3(...headOnPose.target));
  const exited = useRef(false);

  // Mount: snap to head-on, then fly out to the orbit pose — unless
  // this is the initial page load in 3D, which starts AT the orbit
  // pose (nothing to hand off from).
  useEffect(() => {
    const { headOnPose: h, orbitPose: o } = poses.current;
    if (instant) {
      camera.position.set(...o.position);
      lookTarget.current.set(...o.target);
      camera.lookAt(lookTarget.current);
      applyFov(camera, o.fov);
      onControlsChange(true);
      return;
    }
    camera.position.set(...h.position);
    lookTarget.current.set(...h.target);
    camera.lookAt(lookTarget.current);
    applyFov(camera, h.fov);
    anim.current = {
      mode: "enter",
      fromPos: new Vector3(...h.position),
      fromTarget: new Vector3(...h.target),
      toPos: new Vector3(...o.position),
      toTarget: new Vector3(...o.target),
      fromFov: h.fov,
      toFov: o.fov,
      start: null,
      duration: ENTER_S,
    };
    // `instant` is a mount-time snapshot upstream; effect never re-runs
    // with a different value during one mount.
  }, [camera, instant, onControlsChange]);

  useEffect(() => {
    if (exiting) {
      if (anim.current?.mode === "exit") return;
      exited.current = false;
      onControlsChange(false);
      // While OrbitControls was active it owned the real look target.
      const controls = get().controls as unknown as { target?: Vector3 } | null;
      const fromTarget = (controls?.target ?? lookTarget.current).clone();
      const h = poses.current.headOnPose;
      anim.current = {
        mode: "exit",
        fromPos: camera.position.clone(),
        fromTarget,
        toPos: new Vector3(...h.position),
        toTarget: new Vector3(...h.target),
        fromFov: (camera as PerspectiveCamera).fov,
        toFov: h.fov,
        start: null,
        duration: EXIT_S,
      };
    } else if (anim.current?.mode === "exit") {
      // Exit cancelled mid-flight: fly back to the orbit pose.
      const o = poses.current.orbitPose;
      anim.current = {
        mode: "enter",
        fromPos: camera.position.clone(),
        fromTarget: lookTarget.current.clone(),
        toPos: new Vector3(...o.position),
        toTarget: new Vector3(...o.target),
        fromFov: (camera as PerspectiveCamera).fov,
        toFov: o.fov,
        start: null,
        duration: ENTER_S,
      };
    }
  }, [exiting, camera, get, onControlsChange]);

  useFrame((state) => {
    const a = anim.current;
    if (!a) return;
    // Keep frames coming while the camera flies (demand frameloop).
    state.invalidate();
    if (a.start === null) a.start = state.clock.elapsedTime;
    const t = Math.min(1, (state.clock.elapsedTime - a.start) / a.duration);
    const e = easeInOutCubic(t);
    camera.position.lerpVectors(a.fromPos, a.toPos, e);
    lookTarget.current.lerpVectors(a.fromTarget, a.toTarget, e);
    camera.lookAt(lookTarget.current);
    applyFov(camera, a.fromFov + (a.toFov - a.fromFov) * e);
    if (t >= 1) {
      const mode = a.mode;
      anim.current = null;
      if (mode === "enter") {
        onControlsChange(true);
      } else if (!exited.current) {
        exited.current = true;
        onExited?.();
      }
    }
  });

  return null;
}
