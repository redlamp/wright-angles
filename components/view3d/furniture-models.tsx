"use client";

import { useEffect, useMemo } from "react";
import { Color, Material, Mesh, MeshStandardMaterial, type Group, type Object3D } from "three";
import { useGLTF } from "@react-three/drei";

/**
 * Low-poly furniture from Kenney's Furniture Kit (CC0, see
 * public/props/kenney/CREDITS.md): realistic proportions, flat shading.
 * Kenney units are about half a meter; measured in the kit: desk top at
 * 0.384, sofa seat at 0.23, keyboard 0.282 wide. Each piece is scaled
 * onto the scene's constants (cm) where it is placed.
 *
 * The kit's own colors (orange wood, red cushions) would compete with
 * the device key colors, so materials are recolored to the scene
 * palette: cushions to the soft neutral, everything else to furniture.
 */

const base = () => process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const propUrl = (name: string) => `${base()}/props/kenney/${name}.glb`;

/** Every material under an object, deduplicated. */
export function materialsOf(root: Object3D): Material[] {
  const out = new Set<Material>();
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) out.add(mat);
  });
  return [...out];
}

/** Kenney's cushion material is named carpet; the rest is frame. */
const isSoft = (m: Material) => /carpet|cushion|fabric/i.test(m.name);

export interface PropTint {
  furniture: string;
  soft: string;
}

/**
 * A Kenney piece, cloned per use with its own materials so the furniture
 * crossfade can set opacity without touching the shared loader cache.
 * No Draco/Meshopt: drei would otherwise wire a remote decoder path.
 */
export function KenneyProp({
  name,
  scale,
  position = [0, 0, 0],
  rotationY = 0,
  tint,
}: {
  name: string;
  scale: number | [number, number, number];
  position?: [number, number, number];
  rotationY?: number;
  tint: PropTint;
}) {
  const gltf = useGLTF(propUrl(name), false, false);
  const scene = useMemo(() => {
    const s = gltf.scene.clone(true) as Group;
    s.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const own = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => {
        const c = x.clone() as MeshStandardMaterial;
        c.transparent = true;
        return c;
      });
      m.material = own.length === 1 ? own[0] : own;
    });
    return s;
  }, [gltf.scene]);
  useEffect(() => {
    for (const m of materialsOf(scene)) {
      const sm = m as MeshStandardMaterial;
      if (sm.color) sm.color = new Color(isSoft(m) ? tint.soft : tint.furniture);
      sm.roughness = 0.9;
      sm.metalness = 0;
    }
  }, [scene, tint]);
  const sc: [number, number, number] = typeof scale === "number" ? [scale, scale, scale] : scale;
  return <primitive object={scene} scale={sc} position={position} rotation={[0, rotationY, 0]} />;
}
