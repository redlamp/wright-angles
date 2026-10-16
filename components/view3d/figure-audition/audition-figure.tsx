"use client";

import { Suspense, type ComponentProps } from "react";
import { useGLTF } from "@react-three/drei";
import ViewerFigure from "../viewer-figure";
import RiggedFigure from "./rigged-figure";
import { candidateUrl, findCandidate, type Candidate } from "./candidates";
import { useAuditionStore, type FigureLook } from "./audition-store";

type FigureProps = ComponentProps<typeof ViewerFigure>;
type RigProps = FigureProps & {
  candidate: Candidate;
  look: FigureLook;
  outfit: string;
  anchor: "body" | "eyes";
  showRig: boolean;
};

function GltfFigure(props: RigProps) {
  // No Draco/Meshopt: drei would otherwise wire a remote decoder path.
  const gltf = useGLTF(candidateUrl(props.candidate), false, false);
  return <RiggedFigure source={gltf.scene} {...props} />;
}

/**
 * The viewer figure, or the audition candidate picked in the dev
 * overlay. The capsule figure stands in while a candidate loads.
 */
export default function AuditionFigure(props: FigureProps) {
  const id = useAuditionStore((s) => s.candidate);
  const look = useAuditionStore((s) => s.look);
  const outfit = useAuditionStore((s) => s.outfit);
  const anchor = useAuditionStore((s) => s.anchor);
  const showRig = useAuditionStore((s) => s.showRig);
  const local = useAuditionStore((s) => s.local);
  const c = findCandidate(id, local);
  if (!c) return <ViewerFigure {...props} />;
  return (
    <Suspense fallback={<ViewerFigure {...props} />}>
      <GltfFigure
        key={c.id}
        {...props}
        candidate={c}
        look={look}
        outfit={outfit}
        anchor={anchor}
        showRig={showRig}
      />
    </Suspense>
  );
}
