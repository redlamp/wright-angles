import {
  BufferAttribute,
  Color,
  NearestFilter,
  SRGBColorSpace,
  Vector3,
  type Bone,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type SkinnedMesh,
  type Texture,
} from "three";
import { REGIONS, outfitById, outfitColors, regionForBone, type Region } from "./figure-outfits";
import { worldPos } from "./rig-math";

/** What the region pass needs to know about a built rig. */
export interface RegionSource {
  meshes: { mesh: Mesh }[];
  head: Bone;
  eyeY: number;
  height: number;
}

export interface MeshRegions {
  mesh: SkinnedMesh;
  region: Uint8Array;
}

const _v = new Vector3();

/** Dominant bone of a skinned vertex, or null when unweighted. */
export function dominantBone(sk: SkinnedMesh, i: number): Bone | null {
  const idx = sk.geometry.getAttribute("skinIndex");
  const wt = sk.geometry.getAttribute("skinWeight");
  if (!idx || !wt) return null;
  let best = 0;
  let bone = -1;
  for (let j = 0; j < 4; j++) {
    const w = wt.getComponent(i, j);
    if (w > best) {
      best = w;
      bone = idx.getComponent(i, j);
    }
  }
  return bone >= 0 ? sk.skeleton.bones[bone] : null;
}

/** Vertical span of the vertices the head bone drives, in the rest pose. */
/**
 * Vertical span of the head's vertices (chin to crown, world y) and the
 * face's front: the largest z in the middle of that span, which is the
 * nose and brow rather than the chin or hair.
 */
export function headSpan(rig: Pick<RegionSource, "meshes" | "head">): { min: number; max: number; front: number } | null {
  const pts: { y: number; z: number }[] = [];
  let min = Infinity;
  let max = -Infinity;
  for (const { mesh } of rig.meshes) {
    const sk = mesh as SkinnedMesh;
    if (!sk.isSkinnedMesh) continue;
    const n = sk.geometry.getAttribute("position").count;
    for (let i = 0; i < n; i++) {
      if (dominantBone(sk, i) !== rig.head) continue;
      sk.getVertexPosition(i, _v).applyMatrix4(sk.matrixWorld);
      pts.push({ y: _v.y, z: _v.z });
      if (_v.y < min) min = _v.y;
      if (_v.y > max) max = _v.y;
    }
  }
  if (!Number.isFinite(min) || max <= min) return null;
  const lo = min + (max - min) * 0.35;
  const hi = min + (max - min) * 0.75;
  let front = -Infinity;
  for (const p of pts) if (p.y >= lo && p.y <= hi && p.z > front) front = p.z;
  if (!Number.isFinite(front)) for (const p of pts) if (p.z > front) front = p.z;
  return { min, max, front };
}

/**
 * Hairline, as a fraction of body height above the eye estimate: the
 * cap starts about a brow's height above the eyes.
 */
const HAIRLINE_UP = 0.045;
/** Back of the skull counts as hair down to this far below the eyes. */
const NAPE_DOWN = 0.005;

/**
 * Classify every vertex by its dominant bone (rest pose, model space).
 * Head vertices split into hair and skin by position: above the
 * hairline, or behind the head joint and above the nape, is hair. Then
 * each face takes the majority region of its corners so borders stay
 * crisp; geometry must be non-indexed for that to hold.
 */
export function computeRegions(rig: RegionSource): MeshRegions[] {
  const out: MeshRegions[] = [];
  const headPos = worldPos(rig.head, new Vector3());
  const hairline = rig.eyeY + HAIRLINE_UP * rig.height;
  const nape = rig.eyeY - NAPE_DOWN * rig.height;
  const byBone = new Map<Bone, Region | "head" | null>();
  for (const { mesh } of rig.meshes) {
    const sk = mesh as SkinnedMesh;
    if (!sk.isSkinnedMesh) continue;
    const n = sk.geometry.getAttribute("position").count;
    const region = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const bone = dominantBone(sk, i);
      let r: Region | "head" | null = bone ? (byBone.get(bone) ?? null) : null;
      if (bone && !byBone.has(bone)) {
        r = regionForBone(bone.name);
        byBone.set(bone, r);
      }
      if (r === "head") {
        sk.getVertexPosition(i, _v).applyMatrix4(sk.matrixWorld);
        const behind = _v.z < headPos.z && _v.y > nape;
        r = _v.y > hairline || behind ? "hair" : "skin";
      }
      region[i] = REGIONS.indexOf(r ?? "skin");
    }
    for (let f = 0; f + 2 < n; f += 3) {
      const a = region[f];
      const b = region[f + 1];
      const c = region[f + 2];
      const pick = b === c ? b : a;
      region[f] = region[f + 1] = region[f + 2] = pick;
    }
    out.push({ mesh: sk, region });
  }
  return out;
}

const _col = new Color();

/** Write the outfit's region colors into each mesh's color attribute. */
export function applyOutfit(regions: MeshRegions[], outfitId: string) {
  const colors = outfitColors(outfitById(outfitId));
  const rgb = REGIONS.map((r) => {
    _col.set(colors[r]);
    return [_col.r, _col.g, _col.b] as const;
  });
  for (const { mesh, region } of regions) {
    const g = mesh.geometry;
    let attr = g.getAttribute("color") as BufferAttribute | undefined;
    if (!attr || attr.count !== region.length || attr.itemSize !== 3) {
      attr = new BufferAttribute(new Float32Array(region.length * 3), 3);
      g.setAttribute("color", attr);
    }
    for (let i = 0; i < region.length; i++) {
      const [r, gg, b] = rgb[region[i]];
      attr.setXYZ(i, r, gg, b);
    }
    attr.needsUpdate = true;
  }
}

/**
 * Put the palette texture on every own material: some packs ship their
 * glTFs without a texture reference and expect the engine to assign the
 * shared palette, and a chosen variant replaces an embedded one.
 */
export function assignPalette(meshes: { own: Material | Material[] }[], texture: Texture | undefined) {
  if (!texture) return;
  for (const { own } of meshes)
    for (const m of Array.isArray(own) ? own : [own]) {
      const sm = m as MeshStandardMaterial;
      if (sm.map === texture) continue;
      sm.map = texture;
      sm.needsUpdate = true;
    }
}

/**
 * glTF UVs have the origin at the top left and palettes are color data.
 * Palettes are flat blocks, so they sample nearest with no mipmaps: a
 * mipmap blends each block with its neighbors once the figure is small
 * on screen, which darkened painted facets (the reserved white block
 * sits beside black unused ones).
 */
export function preparePalette(tex: Texture | Texture[]) {
  for (const t of Array.isArray(tex) ? tex : [tex]) {
    t.flipY = false;
    t.colorSpace = SRGBColorSpace;
    t.minFilter = NearestFilter;
    t.magFilter = NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
  }
}
