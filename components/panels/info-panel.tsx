"use client";

import { InfoIcon } from "lucide-react";
import { FloatingPanel } from "./floating-panel";

export function InfoPanel() {
  return (
    <FloatingPanel
      id="info"
      title="About Arc Minutes"
      icon={InfoIcon}
      defaultPosition={{ x: 420, y: 360 }}
      width={320}
    >
      <div className="space-y-2 p-3 text-base leading-5 text-muted-foreground">
        <p>
          An <span className="text-foreground">arc minute</span> is 1/60th of
          a degree of your field of view. It measures how big something{" "}
          <em>looks</em>, not how big it is: a 6″ phone at arm&apos;s length
          and a 65″ TV across the room can subtend the same angle — and when
          they do, they feel the same size.
        </p>
        <p>
          That makes arc minutes the common currency for comparing displays.
          20/20 vision resolves about 1′ of detail; text usually needs
          15–20′ of height to stay comfortable. Wright Angles renders every
          device at its true angular size relative to the screen you&apos;re
          sitting at, so those judgements stop being guesses.
        </p>
        <p className="text-sm">
          The same math set the console and handheld font sizes for Disco
          Elysium: The Final Cut.
        </p>
      </div>
    </FloatingPanel>
  );
}
