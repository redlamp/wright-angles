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
 * Skeleton lines over a rigged figure, yellow dots on the wrist targets,
 * a cyan dot on the eye point (where the eye lock holds the eyes) and a
 * magenta dot on the head bone. The helper lives beside the figure, not
 * inside it: SkeletonHelper pins its matrix to the rig root's
 * matrixWorld, and parenting it under a scaled group double-transforms
 * it (prototype-figure-rig).
 */
export default function RigOverlay({
  root,
  grafts,
  targets,
  marks,
}: {
  /** The figure's outer group (world space). */
  root: Object3D;
  /** World-space container of grafted hands, if any; their bones draw too. */
  grafts?: Object3D;
  /** Live wrist targets, world cm; read every frame. */
  targets: { current: Vector3[] };
  /** Eye point, then head bone origin, world cm; read every frame. */
  marks: { current: Vector3[] };
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
    const small = new SphereGeometry(1.1, 10, 8);
    for (const color of ["#33e0ff", "#ff4fd8"]) {
      const d = new Mesh(small, new MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 }));
      d.renderOrder = 12;
      g.add(d);
    }
    return g;
  }, []);
  const handHelper = useMemo(() => {
    if (!grafts) return null;
    let bones = 0;
    grafts.traverse((o) => {
      if ((o as { isBone?: boolean }).isBone) bones++;
    });
    if (!bones) return null;
    const h = new SkeletonHelper(grafts);
    const m = h.material as LineBasicMaterial;
    m.depthTest = false;
    m.transparent = true;
    m.opacity = 0.95;
    h.renderOrder = 10;
    return h;
  }, [grafts]);
  useEffect(() => () => helper.dispose(), [helper]);
  useEffect(() => () => handHelper?.dispose(), [handHelper]);
  useFrame(() => {
    targets.current.forEach((t, i) => {
      const d = dots.children[i];
      if (d) d.position.copy(t);
    });
    marks.current.forEach((m, i) => {
      const d = dots.children[2 + i];
      if (d) d.position.copy(m);
    });
  });
  return (
    <>
      <primitive object={helper} />
      {handHelper ? <primitive object={handHelper} /> : null}
      <primitive object={dots} />
    </>
  );
}
