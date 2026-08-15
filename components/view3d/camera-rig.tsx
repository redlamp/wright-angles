"use client";

import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import { useFrame, useThree } from "@react-three/fiber";

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

const ENTER_S = 1.1;
const EXIT_S = 0.9;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

interface Anim {
  mode: "enter" | "exit";
  fromPos: Vector3;
  fromTarget: Vector3;
  toPos: Vector3;
  toTarget: Vector3;
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
  onExited,
  onControlsChange,
}: {
  orbitPose: CameraPose;
  headOnPose: CameraPose;
  exiting: boolean;
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

  // Mount: snap to head-on, then fly out to the orbit pose.
  useEffect(() => {
    const { headOnPose: h, orbitPose: o } = poses.current;
    camera.position.set(...h.position);
    lookTarget.current.set(...h.target);
    camera.lookAt(lookTarget.current);
    anim.current = {
      mode: "enter",
      fromPos: new Vector3(...h.position),
      fromTarget: new Vector3(...h.target),
      toPos: new Vector3(...o.position),
      toTarget: new Vector3(...o.target),
      start: null,
      duration: ENTER_S,
    };
  }, [camera]);

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
        start: null,
        duration: ENTER_S,
      };
    }
  }, [exiting, camera, get, onControlsChange]);

  useFrame((state) => {
    const a = anim.current;
    if (!a) return;
    if (a.start === null) a.start = state.clock.elapsedTime;
    const t = Math.min(1, (state.clock.elapsedTime - a.start) / a.duration);
    const e = easeInOutCubic(t);
    camera.position.lerpVectors(a.fromPos, a.toPos, e);
    lookTarget.current.lerpVectors(a.fromTarget, a.toTarget, e);
    camera.lookAt(lookTarget.current);
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
