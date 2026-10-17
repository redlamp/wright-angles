"use client";

import { Suspense, type ComponentProps } from "react";
import { useGLTF, useTexture } from "@react-three/drei";
import ViewerFigure from "../viewer-figure";
import RiggedFigure from "./rigged-figure";
import { candidateUrl, findCandidate, textureUrl, type Candidate } from "./candidates";
import { preparePalette } from "./figure-regions";
import { useAuditionStore, type FigureLook } from "./audition-store";

type FigureProps = ComponentProps<typeof ViewerFigure>;
type RigProps = FigureProps & {
  candidate: Candidate;
  look: FigureLook;
  outfit: string;
  showRig: boolean;
};

/** A candidate whose glTF carries no texture reference: the manifest's palette is assigned. */
function TexturedFigure(props: RigProps & { url: string }) {
  const gltf = useGLTF(candidateUrl(props.candidate), false, false);
  const texture = useTexture(props.url, preparePalette);
  return <RiggedFigure source={gltf.scene} texture={texture} {...props} />;
}

function GltfFigure(props: RigProps) {
  // No Draco/Meshopt: drei would otherwise wire a remote decoder path.
  const url = textureUrl(props.candidate);
  if (url) return <TexturedFigure {...props} url={url} />;
  return <PlainFigure {...props} />;
}

function PlainFigure(props: RigProps) {
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
        showRig={showRig}
      />
    </Suspense>
  );
}
