"use client";

import { useMemo, useRef } from "react";
import { Group, MathUtils, Vector3 } from "three";
import { useFrame } from "@react-three/fiber";
import { FirefliesProp } from "../furniture-models";

const DEG = MathUtils.degToRad;

/**
 * The Fireflies gamepad (15 cm wide, origin at the bottom center of its
 * grips, triggers toward +z) held between the hands. World cm; it follows
 * the midpoint of the wrist targets every frame and scales in and out
 * with the stance tween.
 */
export default function ControllerProp({
  targets,
  blend,
}: {
  targets: { current: Vector3[] };
  /** 0..1 presence; it grows out of the hands with the stance tween. */
  blend: { current: number };
}) {
  const ref = useRef<Group>(null);
  const mid = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const g = ref.current;
    const [l, r] = targets.current;
    if (!g || !l || !r) return;
    const b = blend.current;
    g.visible = b > 0.02;
    g.scale.setScalar(Math.max(1e-3, b));
    mid.addVectors(l, r).multiplyScalar(0.5);
    // Grip bottoms sit a little below and ahead of the wrists, in the
    // palms; the face tips toward the viewer's eyes.
    g.position.set(mid.x, mid.y - 2, mid.z + 3);
    g.rotation.set(DEG(-28), 0, 0);
  });
  return (
    <group ref={ref}>
      <FirefliesProp name="gamepad" />
    </group>
  );
}
