"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  Box3,
  MeshStandardMaterial,
  Quaternion,
  SkeletonHelper,
  Vector3,
  type Material,
  type Mesh,
  type Object3D,
} from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { Line, OrbitControls, Text, useGLTF } from "@react-three/drei";
import ViewerFigure from "@/components/view3d/viewer-figure";
import { SCENE_PALETTES } from "@/components/view3d/scene-palette";
import { SEAT_Y } from "@/components/view3d/viewer-figure";
import { eyeHeightCm, type Scenario } from "@/stores/viewer-store";

/**
 * Figure-rig prototype: the current procedural mannequin next to the CC0
 * Quaternius Universal Base Character (Superhero Male), both at 1 unit =
 * 1cm. Proves out the questions that decide the retarget: does the model
 * read at our art direction (clay modes), can we drive its UE-style bones
 * into our stances, and where do its eyes land against the app's
 * eye-height contract.
 */

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const UBC_URL = `${BASE_PATH}/prototype/ubc/Superhero_Male_FullBody.gltf`;

const PALETTE = SCENE_PALETTES.dark;
type MatMode = "clay" | "flat" | "textured";

const CLAY_MAT = new MeshStandardMaterial({
  color: "#b6b6b6",
  roughness: 1,
  metalness: 0,
});
const FLAT_MAT = new MeshStandardMaterial({
  color: "#b6b6b6",
  roughness: 1,
  metalness: 0,
  flatShading: true,
});

/** Everything applyStance needs, captured once per loaded scene. */
interface Prep {
  root: Object3D;
  bones: Map<string, Object3D>;
  rest: Map<Object3D, Quaternion>;
  meshes: Mesh[];
  origMats: Map<Mesh, Material | Material[]>;
  /** Model-space (pre-scale) metrics. */
  nativeHeight: number;
  pelvisY: number;
  eyesY: number;
}

function prepareModel(root: Object3D): Prep {
  root.updateWorldMatrix(true, true);
  const bones = new Map<string, Object3D>();
  const rest = new Map<Object3D, Quaternion>();
  const meshes: Mesh[] = [];
  const origMats = new Map<Mesh, Material | Material[]>();
  root.traverse((o) => {
    if ((o as Mesh).isMesh) {
      meshes.push(o as Mesh);
      origMats.set(o as Mesh, (o as Mesh).material);
    }
    if ((o as { isBone?: boolean }).isBone) {
      bones.set(o.name, o);
      rest.set(o, o.quaternion.clone());
    }
  });
  const box = new Box3().setFromObject(root);
  const v = new Vector3();
  const pelvisY = bones.get("pelvis")?.getWorldPosition(v).y ?? 0;
  const eyes = root.getObjectByName("Eyes");
  const eyesY = eyes
    ? new Box3().setFromObject(eyes).getCenter(new Vector3()).y
    : 0;
  return {
    root,
    bones,
    rest,
    meshes,
    origMats,
    nativeHeight: box.max.y - box.min.y,
    pelvisY: pelvisY - box.min.y,
    eyesY: eyesY - box.min.y,
  };
}

// Module-level scratch + mutators (react-compiler: no property assignment
// on hook-derived objects inside the component body).
const _qParent = new Quaternion();
const _vAxis = new Vector3();
const _vDir = new Vector3();

/**
 * Point a bone's along-axis (derived from its main child's rest offset,
 * so it works for any rig convention) at a world direction. Twist is
 * discarded — fine for a pose prototype, an IK retarget would keep it.
 */
function aimBone(prep: Prep, boneName: string, childName: string, dir: [number, number, number]) {
  const bone = prep.bones.get(boneName);
  const child = prep.bones.get(childName);
  if (!bone || !child || !bone.parent) return;
  bone.parent.getWorldQuaternion(_qParent).invert();
  _vDir.set(dir[0], dir[1], dir[2]).applyQuaternion(_qParent).normalize();
  _vAxis.copy(child.position).normalize();
  bone.quaternion.setFromUnitVectors(_vAxis, _vDir);
  bone.updateWorldMatrix(false, true);
}

/** World-space aim directions per stance; x mirrors for the left side. */
function applyStance(prep: Prep, stance: Scenario) {
  prep.rest.forEach((q, bone) => bone.quaternion.copy(q));
  prep.root.updateWorldMatrix(true, true);
  if (stance === "standing") {
    // The rig's rest is a T-pose; hang the arms so it compares fairly.
    for (const side of [1, -1] as const) {
      const s = side === 1 ? "_r" : "_l";
      aimBone(prep, `upperarm${s}`, `lowerarm${s}`, [side * 0.14, -1, 0.02]);
      aimBone(prep, `lowerarm${s}`, `hand${s}`, [side * 0.04, -1, 0.16]);
    }
    return;
  }
  for (const side of [1, -1] as const) {
    const s = side === 1 ? "_r" : "_l";
    // Thighs forward, shins down: the seated fold.
    aimBone(prep, `thigh${s}`, `calf${s}`, [side * 0.12, -0.08, 1]);
    aimBone(prep, `calf${s}`, `foot${s}`, [side * 0.02, -1, 0.15]);
    if (stance === "desk") {
      // Hands forward over the keyboard.
      aimBone(prep, `upperarm${s}`, `lowerarm${s}`, [side * 0.2, -0.85, 0.35]);
      aimBone(prep, `lowerarm${s}`, `hand${s}`, [side * 0.05, 0.25, 1]);
    } else {
      // Couch: elbows dropped, forearms raked up to a handheld hold.
      aimBone(prep, `upperarm${s}`, `lowerarm${s}`, [side * 0.25, -0.9, 0.1]);
      aimBone(prep, `lowerarm${s}`, `hand${s}`, [side * -0.12, 0.55, 0.75]);
    }
  }
}

function applyMaterials(prep: Prep, mode: MatMode) {
  for (const m of prep.meshes) {
    m.material =
      mode === "textured"
        ? prep.origMats.get(m)!
        : mode === "flat"
          ? FLAT_MAT
          : CLAY_MAT;
  }
}

function UbcFigure({
  stance,
  matMode,
  showSkeleton,
  heightCm,
  onMeasured,
}: {
  stance: Scenario;
  matMode: MatMode;
  showSkeleton: boolean;
  heightCm: number;
  onMeasured: (eyesCm: number, boneCount: number) => void;
}) {
  const { scene } = useGLTF(UBC_URL);
  const invalidate = useThree((st) => st.invalidate);
  const root3 = useThree((st) => st.scene);
  const prep = useMemo(() => prepareModel(scene), [scene]);

  // cm per model unit; the wrapper's scale IS the height slider.
  const s = heightCm / prep.nativeHeight;
  // Seated: drop the whole armature so the pelvis lands 10cm (scaled)
  // above the seat plane, matching the procedural figure's contract.
  const offsetY =
    stance === "standing"
      ? 0
      : SEAT_Y[stance] + 10 * (heightCm / 175) - prep.pelvisY * s;

  useEffect(() => {
    applyStance(prep, stance);
    invalidate();
  }, [prep, stance, invalidate]);

  useEffect(() => {
    applyMaterials(prep, matMode);
    invalidate();
  }, [prep, matMode, invalidate]);

  useEffect(() => {
    onMeasured(prep.eyesY * s + offsetY, prep.bones.size);
  }, [prep, s, offsetY, onMeasured]);

  // SkeletonHelper pins its matrix to the rig root's matrixWorld, so any
  // parent transform double-applies — it must hang off the scene root.
  useEffect(() => {
    if (!showSkeleton) return;
    const helper = new SkeletonHelper(scene);
    root3.add(helper);
    invalidate();
    return () => {
      root3.remove(helper);
      helper.dispose();
      invalidate();
    };
  }, [showSkeleton, scene, root3, invalidate]);

  return (
    <group position={[0, offsetY, 0]} scale={[s, s, s]}>
      <primitive object={scene} />
    </group>
  );
}

/** Dashed reference line across both figures at a given height. */
function HeightLine({ y, color, label }: { y: number; color: string; label: string }) {
  return (
    <group position={[0, y, 0]}>
      <Line
        points={[
          [-140, 0, 0],
          [140, 0, 0],
        ]}
        color={color}
        lineWidth={1}
        dashed
        dashSize={4}
        gapSize={3}
        transparent
        opacity={0.6}
      />
      <Text fontSize={5} color={color} anchorX="left" position={[144, 0, 0]}>
        {label}
      </Text>
    </group>
  );
}

const STANCES: { id: Scenario; label: string }[] = [
  { id: "standing", label: "Standing" },
  { id: "desk", label: "At a desk" },
  { id: "couch", label: "On a couch" },
];
const MAT_MODES: { id: MatMode; label: string }[] = [
  { id: "clay", label: "Clay" },
  { id: "flat", label: "Clay (flat)" },
  { id: "textured", label: "Textured" },
];

const btn = (active: boolean) =>
  `rounded px-2 py-1 text-xs ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"}`;

export default function FigureCompare() {
  const [stance, setStance] = useState<Scenario>("standing");
  const [matMode, setMatMode] = useState<MatMode>("clay");
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [heightCm, setHeightCm] = useState(175);
  const [measured, setMeasured] = useState<{ eyes: number; bones: number } | null>(null);
  // Stable identity + value-equality bail: the measure effect depends on
  // this callback, so a fresh closure (or a fresh state object) per render
  // becomes an effect→setState→render loop that pegs the main thread —
  // exactly what wedged the first test tab.
  const handleMeasured = useCallback(
    (eyes: number, bones: number) =>
      setMeasured((prev) =>
        prev && prev.eyes === eyes && prev.bones === bones
          ? prev
          : { eyes, bones },
      ),
    [],
  );

  const contractEye = eyeHeightCm(stance, heightCm);

  return (
    <div className="relative h-dvh w-full" style={{ background: PALETTE.bg }}>
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [-260, 170, -240], fov: 40, near: 1, far: 5000 }}
      >
        <color attach="background" args={[PALETTE.bg]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2000, 2000]} />
          <meshBasicMaterial color={PALETTE.ground} />
        </mesh>
        <hemisphereLight args={["#ffffff", "#3a3a44", 1.1]} />
        <directionalLight position={[-140, 220, -90]} intensity={1.3} />

        <group position={[-70, 0, 0]}>
          <ViewerFigure scenario={stance} heightCm={heightCm} palette={PALETTE} />
          <Text fontSize={8} color="#9a9aa4" position={[0, -2, -40]} rotation={[-Math.PI / 2, 0, 0]}>
            Current
          </Text>
        </group>
        <group position={[70, 0, 0]}>
          <Suspense fallback={null}>
            <UbcFigure
              stance={stance}
              matMode={matMode}
              showSkeleton={showSkeleton}
              heightCm={heightCm}
              onMeasured={handleMeasured}
            />
          </Suspense>
          <Text fontSize={8} color="#9a9aa4" position={[0, -2, -40]} rotation={[-Math.PI / 2, 0, 0]}>
            Quaternius UBC
          </Text>
        </group>

        <HeightLine y={heightCm} color="#5a5a66" label={`${heightCm} cm`} />
        <HeightLine y={contractEye} color="#c8aa4a" label={`eye ${contractEye.toFixed(0)} cm`} />

        <OrbitControls makeDefault enableDamping target={[0, 90, 0]} maxPolarAngle={Math.PI / 2 - 0.02} />
      </Canvas>

      <div className="absolute left-4 top-4 flex w-64 flex-col gap-3 rounded-lg border border-border bg-card/90 p-3 text-card-foreground backdrop-blur">
        <div className="text-sm font-medium">Figure rig prototype</div>
        <div className="flex flex-wrap gap-1">
          {STANCES.map((st) => (
            <button key={st.id} className={btn(stance === st.id)} onClick={() => setStance(st.id)}>
              {st.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {MAT_MODES.map((m) => (
            <button key={m.id} className={btn(matMode === m.id)} onClick={() => setMatMode(m.id)}>
              {m.label}
            </button>
          ))}
          <button className={btn(showSkeleton)} onClick={() => setShowSkeleton((v) => !v)}>
            Skeleton
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs">
          Height
          <input
            type="range"
            min={150}
            max={200}
            value={heightCm}
            onChange={(e) => setHeightCm(Number(e.target.value))}
            className="flex-1"
          />
          {heightCm} cm
        </label>
        {measured ? (
          <div className="text-xs text-muted-foreground">
            UBC eyes at {measured.eyes.toFixed(1)} cm vs contract{" "}
            {contractEye.toFixed(1)} cm (Δ {(measured.eyes - contractEye).toFixed(1)}) ·{" "}
            {measured.bones} bones
          </div>
        ) : null}
        <div className="text-xs text-muted-foreground">
          CC0 by Quaternius. Poses are rough bone aims, not the final IK —
          judging style, rig, and eye line, not polish.
        </div>
      </div>
    </div>
  );
}
