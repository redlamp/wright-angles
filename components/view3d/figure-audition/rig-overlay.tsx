"use client";

import { useEffect, useMemo } from "react";
import {
  Group,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  SkeletonHelper,
  SphereGeometry,
  Vector3,
  type Object3D,
} from "three";
import { useFrame } from "@react-three/fiber";

/**
 * Skeleton lines over a rigged figure plus dots on the wrist targets.
 * The helper lives beside the figure, not inside it: SkeletonHelper
 * pins its matrix to the rig root's matrixWorld, and parenting it under
 * a scaled group double-transforms it (prototype-figure-rig).
 */
export default function RigOverlay({
  root,
  targets,
}: {
  /** The figure's outer group (world space). */
  root: Object3D;
  /** Live wrist targets, world cm; read every frame. */
  targets: { current: Vector3[] };
}) {
  const helper = useMemo(() => {
    const h = new SkeletonHelper(root);
    const m = h.material as LineBasicMaterial;
    m.depthTest = false;
    m.transparent = true;
    m.opacity = 0.95;
    h.renderOrder = 10;
    return h;
  }, [root]);
  const dots = useMemo(() => {
    const g = new Group();
    const geo = new SphereGeometry(1.6, 10, 8);
    const mat = new MeshBasicMaterial({ color: "#ffcc33", depthTest: false, transparent: true, opacity: 0.95 });
    for (let i = 0; i < 2; i++) {
      const d = new Mesh(geo, mat);
      d.renderOrder = 11;
      g.add(d);
    }
    return g;
  }, []);
  useEffect(() => () => helper.dispose(), [helper]);
  useFrame(() => {
    targets.current.forEach((t, i) => {
      const d = dots.children[i];
      if (d) d.position.copy(t);
    });
  });
  return (
    <>
      <primitive object={helper} />
      <primitive object={dots} />
    </>
  );
}
