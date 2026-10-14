"use client";

import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Shared layout of the two measuring steps: illustration beside the
 * instruction, the pre-check notice, the stage, its controls, and
 * Back / Next. Width follows the stage so a large screen gets a large
 * stage.
 */
export function MeasureFrame({
  width,
  title,
  description,
  illustration,
  notice,
  stage,
  controls,
  onBack,
  onNext,
}: {
  width: number;
  title: string;
  description: React.ReactNode;
  illustration: React.ReactNode;
  notice: React.ReactNode;
  stage: React.ReactNode;
  controls: React.ReactNode;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="grid gap-3" style={{ width }}>
      <DialogHeader className="flex-row items-center gap-4">
        {illustration}
        <div className="flex min-w-0 flex-col gap-1.5">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="leading-5">{description}</DialogDescription>
        </div>
      </DialogHeader>
      {notice}
      {stage}
      {controls}
      <DialogFooter className="sm:justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>See the result</Button>
      </DialogFooter>
    </div>
  );
}
