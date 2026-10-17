"use client";

import { useMemo, useRef } from "react";
import { Euler, Group, MathUtils, Matrix4, Quaternion, Vector3 } from "three";
import { useFrame } from "@react-three/fiber";
import { PivotControls } from "@react-three/drei";
import type { HandFit, HandGraft } from "./hand-graft";
import { useAuditionStore } from "./audition-store";
import { worldPos } from "./rig-math";
import type { Bone } from "three";

const DEG = MathUtils.degToRad;

/**
 * A pivot gizmo on the left hand's wrist, in the aligned hand frame (x
 * along the fingers, y along the palm normal, z across the wrist). Its
 * arrows slide the hand, its rings rotate it and its handles scale it;
 * the result is written back into the per-model HandFit, so the right
 * hand mirrors it and the numbers can be baked later. Shown in T-pose.
 */
export default function HandGizmo({
  graft,
  fit,
  onChange,
}: {
  graft: HandGraft;
  fit: HandFit;
  onChange: (fit: HandFit) => void;
}) {
  const anchor = useRef<Group>(null);
  const matrix = useMemo(() => {
    const m = new Matrix4();
    const q = new Quaternion().setFromEuler(new Euler(DEG(fit.rotX), DEG(fit.rotY), DEG(fit.rotZ), "XYZ"));
    return m.compose(new Vector3(fit.slideZ, fit.slideY, fit.slideX), q, new Vector3(fit.size, fit.size, fit.size));
  }, [fit]);
  const tmp = useMemo(() => ({ p: new Vector3(), q: new Quaternion(), s: new Vector3(), e: new Euler() }), []);
  useFrame(() => {
    const a = anchor.current;
    if (!a) return;
    a.position.copy(graft.anchorPos);
    a.quaternion.copy(graft.anchorQ);
    a.updateMatrixWorld(true);
  });
  return (
    <group ref={anchor}>
      <PivotControls
        matrix={matrix}
        autoTransform={false}
        depthTest={false}
        scale={10}
        lineWidth={2}
        fixed={false}
        onDrag={(l) => {
          l.decompose(tmp.p, tmp.q, tmp.s);
          tmp.e.setFromQuaternion(tmp.q, "XYZ");
          onChange({
            size: Math.min(1.5, Math.max(0.5, tmp.s.x)),
            flareX: fit.flareX,
            flareY: fit.flareY,
            slideZ: tmp.p.x,
            slideY: tmp.p.y,
            slideX: tmp.p.z,
            rotX: MathUtils.radToDeg(tmp.e.x),
            rotY: MathUtils.radToDeg(tmp.e.y),
            rotZ: MathUtils.radToDeg(tmp.e.z),
          });
        }}
      />
    </group>
  );
}

const FOCUS_OFFSET = new Vector3(0.5, 0.45, 0.75).normalize().multiplyScalar(55);

/**
 * Snaps the orbit camera onto the left wrist when the picker asks (a
 * counter in the store): target on the wrist, camera 55 cm away, in
 * front, above and to the figure's left. Always mounted, no render.
 */
export function WristFocus({ graft, hand }: { graft: HandGraft | null; hand: Bone }) {
  const seen = useRef(useAuditionStore.getState().focusWrist);
  const at = useMemo(() => new Vector3(), []);
  useFrame((state) => {
    const n = useAuditionStore.getState().focusWrist;
    if (n === seen.current) return;
    seen.current = n;
    if (graft) at.copy(graft.anchorPos);
    else worldPos(hand, at);
    const controls = state.controls as { target: Vector3; update: () => void } | null;
    state.camera.position.copy(at).add(FOCUS_OFFSET);
    if (controls) {
      controls.target.copy(at);
      controls.update();
    } else state.camera.lookAt(at);
    state.invalidate();
  });
  return null;
}
