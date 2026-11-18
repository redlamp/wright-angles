"use client";

import { useMemo, useRef } from "react";
import { Euler, Group, MathUtils, Quaternion, Vector3 } from "three";
import { useFrame } from "@react-three/fiber";
import { FirefliesProp } from "../furniture-models";

const DEG = MathUtils.degToRad;

/**
 * Where the pad's grips sit in its own frame (cm, origin at the bottom
 * center, grips toward -z): measured on gamepad.glb as the centroid of
 * each grip lobe. The midpoint is what lands between the two palms.
 */
const GRIP_MID = new Vector3(0, 2.5, -3.26);
/** Face tipped up toward the player's eyes. */
const PITCH_DEG = -28;

/**
 * The Fireflies gamepad held in the hands. Each frame it is placed from
 * the two palm grip points the rig reports (between the thumb root and
 * the finger roots, a grip's radius into the palm): the pad's grip
 * midpoint goes to the midpoint of those, yawed so its grips line up
 * with the hands. It scales in and out with the stance tween.
 */
export default function ControllerProp({
  grips,
  blend,
}: {
  /** World grip points, left then right. */
  grips: { current: Vector3[] };
  /** 0..1 presence; it grows out of the hands with the stance tween. */
  blend: { current: number };
}) {
  const ref = useRef<Group>(null);
  const tmp = useMemo(() => ({ mid: new Vector3(), across: new Vector3(), off: new Vector3(), e: new Euler(), q: new Quaternion() }), []);
  useFrame(() => {
    const g = ref.current;
    const [l, r] = grips.current;
    if (!g || !l || !r) return;
    const b = blend.current;
    g.visible = b > 0.02;
    g.scale.setScalar(Math.max(1e-3, b));
    const { mid, across, off, e, q } = tmp;
    mid.addVectors(l, r).multiplyScalar(0.5);
    across.subVectors(l, r);
    const yaw = Math.atan2(-across.z, across.x);
    // Pitch in the pad's own frame, then yaw it to the hands (YXZ).
    q.setFromEuler(e.set(DEG(PITCH_DEG), yaw, 0, "YXZ"));
    off.copy(GRIP_MID).applyQuaternion(q);
    g.position.subVectors(mid, off);
    g.quaternion.copy(q);
  });
  return (
    <group ref={ref}>
      <FirefliesProp name="gamepad" />
    </group>
  );
}
