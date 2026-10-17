import {
  Color,
  Group,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  type Bone,
  type Mesh,
  type Object3D,
  type SkinnedMesh,
  type Texture,
} from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { dominantBone } from "./figure-regions";
import { chainOf } from "./rig-math";

/**
 * A five-fingered hand (the MPFB export in public/figures/audition/mpfb,
 * CC0) worn over a figure's own hand. The figure's hand bone is collapsed
 * so its mitten vanishes into the wrist, and this hand follows that bone
 * every frame: wrist on the wrist, fingers along the figure's finger
 * direction, palm along its palm normal. The hand plans then curl these
 * fingers instead of the mitten's.
 */
export interface HandGraft {
  /** World-space container, scaled to the figure's height. */
  group: Group;
  /** The hand asset's armature node, driven to follow the figure's hand bone. */
  armature: Object3D;
  /** The hand asset's wrist bone and its rest transform under the armature. */
  root: Bone;
  rootRestP: Vector3;
  rootRestQ: Quaternion;
  /** Rotation taking the asset's hand frame onto the figure's hand frame. */
  align: Quaternion;
  mesh: SkinnedMesh;
  material: MeshStandardMaterial;
  /** Digits for the hand plans: index root, thumb root, and the chains. */
  finger: Bone;
  thumb: Bone;
  fingerChains: Bone[][];
  thumbChain: Bone[];
  /** Hand asset units are cm at a 175 cm body; set per frame. */
  scale: number;
}

/** Height the MPFB hand was exported at. */
export const GRAFT_AUTHORED_CM = 175;

/** The loaded hand assets, one scene per side. */
export interface HandSources {
  left: Object3D;
  right: Object3D;
}

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _q = new Quaternion();
const _m = new Matrix4();

const findBone = (root: Object3D, re: RegExp): Bone | null => {
  let out: Bone | null = null;
  root.traverse((o) => {
    if (!out && (o as Bone).isBone && re.test(o.name)) out = o as Bone;
  });
  return out;
};

/** Quaternion of the frame whose axes are f, p and f x p (p made orthogonal to f). */
function frameQuat(f: Vector3, p: Vector3, out: Quaternion): Quaternion {
  const x = _a.copy(f).normalize();
  const y = _b.copy(p).addScaledVector(x, -x.dot(p)).normalize();
  const z = _c.crossVectors(x, y);
  return out.setFromRotationMatrix(_m.makeBasis(x, y, z));
}

/**
 * Build a graft for one side. `fingerDirLocal` and `palmLocal` are the
 * figure's finger direction and palm normal in its hand bone's frame.
 */
export function buildGraft(source: Object3D, side: 1 | -1, fingerDirLocal: Vector3, palmLocal: Vector3): HandGraft | null {
  const scene = cloneSkinned(source) as Group;
  const root = findBone(scene, /^hand/i);
  const finger = findBone(scene, /^index_01/i);
  const middle = findBone(scene, /^middle_01/i);
  const ring = findBone(scene, /^ring_01/i);
  const pinky = findBone(scene, /^pinky_01/i);
  const thumb = findBone(scene, /^thumb_01/i);
  let mesh: SkinnedMesh | null = null;
  scene.traverse((o) => {
    if (!mesh && (o as SkinnedMesh).isSkinnedMesh) mesh = o as SkinnedMesh;
  });
  if (!root || !finger || !thumb || !mesh || !root.parent) return null;
  const sk = mesh as SkinnedMesh;
  sk.frustumCulled = false;
  const material = new MeshStandardMaterial({ color: "#d9a98c", roughness: 0.9, metalness: 0 });
  sk.material = material;

  // The asset's own hand frame, in its wrist bone's space.
  scene.updateMatrixWorld(true);
  const inv = root.getWorldQuaternion(new Quaternion()).invert();
  const wrist = root.getWorldPosition(new Vector3());
  const fA = finger.getWorldPosition(new Vector3()).sub(wrist).applyQuaternion(inv).normalize();
  const tA = thumb.getWorldPosition(new Vector3()).sub(wrist).applyQuaternion(inv).normalize();
  const pA = side === 1 ? fA.clone().cross(tA) : tA.clone().cross(fA);
  if (pA.lengthSq() < 1e-6) return null;
  const qA = frameQuat(fA, pA.normalize(), new Quaternion());
  const qF = frameQuat(fingerDirLocal, palmLocal, new Quaternion());
  const align = qF.multiply(qA.invert());

  const group = new Group();
  group.add(scene);
  return {
    group,
    armature: root.parent,
    root,
    rootRestP: root.position.clone(),
    rootRestQ: root.quaternion.clone(),
    align,
    mesh: sk,
    material,
    finger,
    thumb,
    fingerChains: [finger, middle, ring, pinky].filter((b): b is Bone => !!b).map(chainOf),
    thumbChain: chainOf(thumb),
    scale: 1,
  };
}

/** Put the graft's wrist on the figure's hand bone, oriented like it. */
export function placeGraft(g: HandGraft, hand: Bone) {
  hand.getWorldQuaternion(_q).multiply(g.align);
  // Drive the armature so that its root bone (rest transform rootRestP,
  // rootRestQ under it) lands on the hand bone.
  g.armature.quaternion.copy(_q).multiply(g.rootRestQ.clone().invert());
  g.armature.scale.setScalar(g.scale);
  hand.getWorldPosition(_a);
  _b.copy(g.rootRestP).multiplyScalar(g.scale).applyQuaternion(g.armature.quaternion);
  g.armature.position.copy(_a).sub(_b);
  g.group.updateMatrixWorld(true);
}

/**
 * The figure's skin color at its hand: the palette texel under the
 * hand-driven vertex farthest from the wrist (a fingertip, past any cuff
 * or sleeve), or that mesh's flat color when there is no texture. A
 * gloved model yields its glove color, which is what the graft should
 * wear. Returns null when nothing can be sampled.
 */
export function sampleSkin(meshes: { mesh: Mesh }[], hand: Bone, texture: Texture | undefined): Color | null {
  // Measured in the bind pose: by now the figure's hand bone is collapsed,
  // so posed positions all sit at the wrist.
  let best: { mesh: SkinnedMesh; i: number; d: number } | null = null;
  for (const { mesh: m } of meshes) {
    const mesh = m as SkinnedMesh;
    if (!mesh.isSkinnedMesh) continue;
    const j = mesh.skeleton.bones.indexOf(hand);
    if (j < 0) continue;
    const wrist = _c.setFromMatrixPosition(_m.copy(mesh.skeleton.boneInverses[j]).invert());
    const pos = mesh.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      if (dominantBone(mesh, i) !== hand) continue;
      const d = _a.fromBufferAttribute(pos, i).distanceToSquared(wrist);
      if (!best || d > best.d) best = { mesh, i, d };
    }
  }
  if (!best) return null;
  const { mesh, i } = best;
  const uv = mesh.geometry.getAttribute("uv");
  const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshStandardMaterial;
  const tex = texture ?? mat.map ?? undefined;
  if (tex && uv) {
    const px = readTexel(tex, uv.getX(i), uv.getY(i));
    if (px) return px;
  }
  return mat.color ? mat.color.clone() : null;
}

/** Color each grafted hand with its figure's skin tone. */
export function applySkin(sides: Record<1 | -1, { hand: Bone; graft: HandGraft | null }>, meshes: { mesh: Mesh }[], texture: Texture | undefined) {
  for (const side of [1, -1] as const) {
    const s = sides[side];
    if (!s.graft) continue;
    const c = sampleSkin(meshes, s.hand, texture);
    if (c) s.graft.material.color.copy(c);
  }
}

function readTexel(tex: Texture, u: number, v: number): Color | null {
  const img = tex.image as CanvasImageSource & { width: number; height: number };
  if (!img || !img.width || !img.height || typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const fu = u - Math.floor(u);
  const fv = v - Math.floor(v);
  // flipY false: v runs from the image's top row.
  const y = tex.flipY ? (1 - fv) * img.height : fv * img.height;
  ctx.drawImage(img, Math.floor(fu * img.width), Math.floor(y), 1, 1, 0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return new Color().setRGB(d[0] / 255, d[1] / 255, d[2] / 255, SRGBColorSpace);
}
