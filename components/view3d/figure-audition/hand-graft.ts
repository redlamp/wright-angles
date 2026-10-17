import {
  BufferGeometry,
  Color,
  DoubleSide,
  Euler,
  Group,
  MathUtils,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SkinnedMesh,
  SRGBColorSpace,
  Vector3,
  type Bone,
  type Mesh,
  type Object3D,
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
  /** Every digit bone with its rest rotation: restored before each frame's curl. */
  rest: [Bone, Quaternion][];
  /** Hand asset units are cm at a 175 cm body; set per frame. */
  scale: number;
  /** Figure model units to cm, set per frame with the scale. */
  k: number;
  /** Live per-model adjustments. */
  fit: HandFit;
  /** The aligned wrist frame this frame, before the fit's slides and rotation: where a gizmo sits. */
  anchorPos: Vector3;
  anchorQ: Quaternion;
  /** The overlap below the wrist and what it should flare to: figure forearm end radius (model units) over the stub's own radius (cm). */
  stub: Bone | null;
  flare: { figureUnits: number; assetCm: number } | null;
  /** The figure's own hand length (wrist to mitten tip, model units) and the asset's (cm): the graft is sized so the tips coincide. */
  length: { figureUnits: number; assetCm: number } | null;
  /** The figure's sampled skin (or glove) color, for the own-material look. */
  skin: Color | null;
}

/** Height the MPFB hand was exported at. */
export const GRAFT_AUTHORED_CM = 175;

/**
 * Per-model hand adjustments, dialed in by eye. size multiplies the whole
 * hand; flareX and flareY multiply the wrist's width (thumb direction)
 * and thickness (palm direction); slideX, slideY and slideZ move the hand
 * across the wrist, along the palm normal and along the arm (cm, slideZ
 * negative toward the elbow).
 */
export interface HandFit {
  size: number;
  flareX: number;
  flareY: number;
  slideX: number;
  slideY: number;
  slideZ: number;
  /** Rotation in the aligned frame, degrees: about the fingers (roll), the palm normal (yaw) and across the wrist (pitch). */
  rotX: number;
  rotY: number;
  rotZ: number;
}
export const DEFAULT_HAND_FIT: HandFit = { size: 1, flareX: 1, flareY: 1, slideX: 0, slideY: 0, slideZ: 0, rotX: 0, rotY: 0, rotZ: 0 };

type RawFit = Partial<HandFit> & { flare?: number; slide?: number };
/** Fits as saved or as a manifest bakes them: per side, or one shared fit. */
export type RawFits = RawFit | { left?: RawFit; right?: RawFit };

/** Accepts fits saved under the earlier shape (one flare, one slide). */
export function normalizeFit(raw: RawFit | undefined): HandFit {
  if (!raw) return DEFAULT_HAND_FIT;
  return {
    size: raw.size ?? 1,
    flareX: raw.flareX ?? raw.flare ?? 1,
    flareY: raw.flareY ?? raw.flare ?? 1,
    slideX: raw.slideX ?? 0,
    slideY: raw.slideY ?? 0,
    slideZ: raw.slideZ ?? raw.slide ?? 0,
    rotX: raw.rotX ?? 0,
    rotY: raw.rotY ?? 0,
    rotZ: raw.rotZ ?? 0,
  };
}

/** One fit per hand: the two wrists never sit alike, so the right is its own, not a mirror of the left. */
export interface SideFits {
  left: HandFit;
  right: HandFit;
}
export const DEFAULT_SIDE_FITS: SideFits = { left: DEFAULT_HAND_FIT, right: DEFAULT_HAND_FIT };
export const sideFit = (f: SideFits, side: 1 | -1) => (side === 1 ? f.left : f.right);

/** The same fit seen from the other hand: the across slide, roll and yaw flip sign. */
export function mirrorFit(f: HandFit): HandFit {
  return { ...f, slideX: -f.slideX, rotX: -f.rotX, rotY: -f.rotY };
}

/** Accepts fits saved per side, or the earlier single fit (which the right hand mirrored then). */
export function normalizeFits(raw: RawFits | undefined): SideFits {
  if (!raw) return DEFAULT_SIDE_FITS;
  if ("left" in raw || "right" in raw) {
    const r = raw as { left?: RawFit; right?: RawFit };
    return { left: normalizeFit(r.left), right: normalizeFit(r.right) };
  }
  const left = normalizeFit(raw as RawFit);
  return { left, right: mirrorFit(left) };
}

/** The loaded hand assets, one scene per side. */
export interface HandSources {
  left: Object3D;
  right: Object3D;
}

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _q = new Quaternion();
const _qf = new Quaternion();
const _e = new Euler();
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
  // A three-finger block (fingers_01) or separate middle, ring and pinky.
  const middle = findBone(scene, /^(middle|fingers)_01/i);
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
  const fingerChains = [finger, middle, ring, pinky].filter((b): b is Bone => !!b).map(chainOf);
  const thumbChain = chainOf(thumb);
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
    fingerChains,
    thumbChain,
    rest: [...fingerChains.flat(), ...thumbChain].map((b) => [b, b.quaternion.clone()]),
    scale: 1,
    k: 1,
    fit: DEFAULT_HAND_FIT,
    anchorPos: new Vector3(),
    anchorQ: new Quaternion(),
    stub: findBone(scene, /^stub/i),
    flare: null,
    length: null,
    skin: null,
  };
}

/**
 * Put the graft's wrist on the figure's hand bone, oriented like it, then
 * apply that hand's own fit (set by graftScale). Slides and rotations are
 * in the aligned frame: x fingers, y palm normal, z across the wrist.
 */
export function placeGraft(g: HandGraft, hand: Bone) {
  // Curls are applied fresh each frame on top of the rest pose.
  for (const [b, q] of g.rest) b.quaternion.copy(q);
  hand.getWorldQuaternion(_q).multiply(g.align);
  g.anchorQ.copy(_q);
  hand.getWorldPosition(g.anchorPos);
  const f = g.fit;
  if (f.rotX || f.rotY || f.rotZ) {
    _qf.setFromEuler(_e.set(MathUtils.degToRad(f.rotX), MathUtils.degToRad(f.rotY), MathUtils.degToRad(f.rotZ), "XYZ"));
    _q.multiply(_qf);
  }
  // Drive the armature so that its root bone (rest transform rootRestP,
  // rootRestQ under it) lands on the hand bone.
  g.armature.quaternion.copy(_q).multiply(g.rootRestQ.clone().invert());
  g.armature.scale.setScalar(g.scale);
  if (g.stub && g.flare) {
    // Radial only: the stub bone points back along the arm (local Y); its
    // local X is the wrist's width (thumb direction) and local Z its thickness.
    const f = (g.flare.figureUnits * g.k) / (g.flare.assetCm * g.scale);
    const clamp = (v: number) => Math.min(3, Math.max(0.5, v));
    g.stub.scale.set(clamp(f * g.fit.flareX), 1, clamp(f * g.fit.flareY));
  }
  _a.copy(g.anchorPos);
  // Slide in the aligned hand frame (before the fit rotation): x along the fingers, y along the palm normal, z across the wrist.
  if (f.slideZ) _a.addScaledVector(_c.set(1, 0, 0).applyQuaternion(g.anchorQ), f.slideZ);
  if (f.slideY) _a.addScaledVector(_c.set(0, 1, 0).applyQuaternion(g.anchorQ), f.slideY);
  if (f.slideX) _a.addScaledVector(_c.set(0, 0, 1).applyQuaternion(g.anchorQ), f.slideX);
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

/** Remember each grafted hand's figure skin tone (sampled from the palette). */
export function applySkin(sides: Record<1 | -1, { hand: Bone; graft: HandGraft | null }>, meshes: { mesh: Mesh }[], texture: Texture | undefined) {
  for (const side of [1, -1] as const) {
    const s = sides[side];
    if (!s.graft) continue;
    const c = sampleSkin(meshes, s.hand, texture);
    s.graft.skin = c;
    if (c) s.graft.material.color.copy(c);
  }
}

/**
 * The hand follows the figure's look: the scene gray when the figure is
 * gray, the outfit's skin color when it wears a painted outfit, else its
 * own sampled skin.
 */
export function setGraftLook(sides: Record<1 | -1, { graft: HandGraft | null }>, look: "own" | "gray" | "outfit", gray: string, outfitSkin: string | undefined) {
  for (const side of [1, -1] as const) {
    const g = sides[side].graft;
    if (!g) continue;
    if (look === "gray") g.material.color.set(gray);
    else if (look === "outfit" && outfitSkin) g.material.color.set(outfitSkin);
    else if (g.skin) g.material.color.copy(g.skin);
  }
}

/**
 * Measure the figure's forearm where the hand's stub will sit (bind pose,
 * model units: radius of the forearm-driven vertices in its last tenth)
 * and the stub's own radius at the cut (cm), so the stub can flare to the
 * arm it disappears into.
 */
export function fitWrist(g: HandGraft, meshes: { mesh: Mesh }[], foreArm: Bone, hand: Bone) {
  const radii: number[] = [];
  for (const { mesh: m } of meshes) {
    const mesh = m as SkinnedMesh;
    if (!mesh.isSkinnedMesh) continue;
    const jf = mesh.skeleton.bones.indexOf(foreArm);
    const jh = mesh.skeleton.bones.indexOf(hand);
    if (jf < 0 || jh < 0) continue;
    const pf = new Vector3().setFromMatrixPosition(_m.copy(mesh.skeleton.boneInverses[jf]).invert());
    const ph = new Vector3().setFromMatrixPosition(_m.copy(mesh.skeleton.boneInverses[jh]).invert());
    const axis = _b.subVectors(ph, pf);
    const len = axis.length();
    if (len < 1e-6) continue;
    axis.divideScalar(len);
    const pos = mesh.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      if (dominantBone(mesh, i) !== foreArm) continue;
      _a.fromBufferAttribute(pos, i).sub(pf);
      const t = _a.dot(axis);
      if (t < 0.88 * len) continue;
      radii.push(_a.addScaledVector(axis, -t).length());
    }
  }
  radii.sort((x, y) => x - y);
  const figure = radii.length ? radii[Math.floor(radii.length * 0.85)] : 0;
  // The mitten's reach past the wrist along the arm's axis, before it is flattened.
  const mitten = new Set<Bone>(chainOf(hand));
  let reach = 0;
  for (const { mesh: m } of meshes) {
    const mesh = m as SkinnedMesh;
    if (!mesh.isSkinnedMesh) continue;
    const jf = mesh.skeleton.bones.indexOf(foreArm);
    const jh = mesh.skeleton.bones.indexOf(hand);
    if (jf < 0 || jh < 0) continue;
    const pf = new Vector3().setFromMatrixPosition(_m.copy(mesh.skeleton.boneInverses[jf]).invert());
    const ph = new Vector3().setFromMatrixPosition(_m.copy(mesh.skeleton.boneInverses[jh]).invert());
    const axis = _b.subVectors(ph, pf).normalize();
    const pos = mesh.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const b = dominantBone(mesh, i);
      if (!b || !mitten.has(b)) continue;
      reach = Math.max(reach, _a.fromBufferAttribute(pos, i).sub(ph).dot(axis));
    }
  }
  // The asset's radius at its wrist plane (asset frame: fingers along -z).
  const pos = g.mesh.geometry.getAttribute("position");
  let asset = 0;
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getZ(i)) > 0.4) continue;
    asset = Math.max(asset, Math.hypot(pos.getX(i), pos.getY(i)));
  }
  g.flare = figure > 0 && asset > 0 && g.stub ? { figureUnits: figure, assetCm: asset } : null;
  // The asset's own reach: fingertips along -z from the wrist.
  let tip = 0;
  for (let i = 0; i < pos.count; i++) tip = Math.max(tip, -pos.getZ(i));
  g.length = reach > 0 && tip > 0 ? { figureUnits: reach, assetCm: tip } : null;
}

/**
 * The hand's scale for this frame: sized so its fingertips land where the
 * figure's own mitten tips were (wrist to tip), times the live size
 * nudge; without a mitten measurement, the height scale and the model's
 * hand-size tuning.
 */
export function graftScale(g: HandGraft, heightCm: number, k: number, handScale: number, fit: HandFit): number {
  g.k = k;
  g.fit = fit;
  const base = g.length ? (g.length.figureUnits * k) / g.length.assetCm : (heightCm / GRAFT_AUTHORED_CM) * handScale;
  return base * fit.size;
}

/**
 * Hide the figure's own hand without collapsing its bone: every vertex
 * the hand bone or its digits drive that sits past the wrist is moved to
 * the wrist point (bind pose). The mitten's own faces vanish and the
 * forearm's cuff ring fans to that point as a flat cap, which the grafted
 * hand's stub covers. Vertices with partial hand weight keep their place,
 * so the cuff is not dragged into a taper. A disk (keeping the radial
 * offsets) was tried first and showed as a flat plate wider than the
 * hand's wrist.
 */
export function flattenMitten(meshes: { mesh: Mesh }[], hand: Bone, foreArm: Bone) {
  const mitten = new Set<Bone>(chainOf(hand));
  for (const { mesh: m } of meshes) {
    const mesh = m as SkinnedMesh;
    if (!mesh.isSkinnedMesh) continue;
    const jf = mesh.skeleton.bones.indexOf(foreArm);
    const jh = mesh.skeleton.bones.indexOf(hand);
    if (jf < 0 || jh < 0) continue;
    const pf = new Vector3().setFromMatrixPosition(_m.copy(mesh.skeleton.boneInverses[jf]).invert());
    const ph = new Vector3().setFromMatrixPosition(_m.copy(mesh.skeleton.boneInverses[jh]).invert());
    const axis = _b.subVectors(ph, pf).normalize();
    const pos = mesh.geometry.getAttribute("position");
    let changed = false;
    for (let i = 0; i < pos.count; i++) {
      const b = dominantBone(mesh, i);
      if (!b || !mitten.has(b)) continue;
      _a.fromBufferAttribute(pos, i).sub(ph);
      const t = _a.dot(axis);
      if (t <= 0) continue;
      pos.setXYZ(i, ph.x, ph.y, ph.z);
      changed = true;
    }
    if (changed) {
      pos.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    }
  }
}

const GHOST_MATERIAL = new MeshBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: 0.4, depthTest: false, depthWrite: false, side: DoubleSide });

/**
 * A see-through copy of the figure's own hand, the mitten flattenMitten
 * is about to hide: the same vertices, skinned to the same skeleton, so
 * it follows the arm and the grafted hand can be lined up against it.
 * Hidden until asked for. Call before flattenMitten.
 */
export function ghostMitten(meshes: { mesh: Mesh }[], hand: Bone, foreArm: Bone): SkinnedMesh[] {
  const mitten = new Set<Bone>(chainOf(hand));
  const out: SkinnedMesh[] = [];
  for (const { mesh: m } of meshes) {
    const mesh = m as SkinnedMesh;
    if (!mesh.isSkinnedMesh) continue;
    const jf = mesh.skeleton.bones.indexOf(foreArm);
    const jh = mesh.skeleton.bones.indexOf(hand);
    if (jf < 0 || jh < 0) continue;
    const pf = new Vector3().setFromMatrixPosition(_m.copy(mesh.skeleton.boneInverses[jf]).invert());
    const ph = new Vector3().setFromMatrixPosition(_m.copy(mesh.skeleton.boneInverses[jh]).invert());
    const axis = _b.subVectors(ph, pf).normalize();
    const geo = mesh.geometry;
    const pos = geo.getAttribute("position");
    const keep = new Uint8Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const b = dominantBone(mesh, i);
      if (!b || !mitten.has(b)) continue;
      if (_a.fromBufferAttribute(pos, i).sub(ph).dot(axis) > 0) keep[i] = 1;
    }
    const index = geo.getIndex();
    const n = index ? index.count : pos.count;
    const tris: number[] = [];
    for (let i = 0; i + 2 < n; i += 3) {
      const [a, b, c] = index ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)] : [i, i + 1, i + 2];
      if (keep[a] && keep[b] && keep[c]) tris.push(a, b, c);
    }
    if (!tris.length) continue;
    const g = new BufferGeometry();
    for (const name of ["position", "normal", "skinIndex", "skinWeight"]) {
      const at = geo.getAttribute(name);
      if (at) g.setAttribute(name, at.clone());
    }
    g.setIndex(tris);
    const ghost = new SkinnedMesh(g, GHOST_MATERIAL);
    ghost.bind(mesh.skeleton, mesh.bindMatrix);
    ghost.frustumCulled = false;
    ghost.renderOrder = 5;
    ghost.visible = false;
    mesh.add(ghost);
    out.push(ghost);
  }
  return out;
}

/** Measure the wrist for the graft, keep a ghost of the mitten, then hide the mitten. Returns the ghosts. */
export function replaceMitten(g: HandGraft, meshes: { mesh: Mesh }[], hand: Bone, foreArm: Bone): SkinnedMesh[] {
  fitWrist(g, meshes, foreArm, hand);
  const ghosts = ghostMitten(meshes, hand, foreArm);
  flattenMitten(meshes, hand, foreArm);
  return ghosts;
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
