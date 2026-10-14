"use client";

import { ChevronRightIcon, CreditCardIcon, RulerIcon, TypeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FOCUS_RING, NARROW_STEP } from "./constants";

export type Method = "card" | "ruler" | "known";

const METHODS: {
  id: Method;
  icon: typeof RulerIcon;
  title: string;
  tag?: string;
  detail: string;
}[] = [
  {
    id: "card",
    icon: CreditCardIcon,
    title: "Measure with a card",
    tag: "Recommended",
    detail: "About 30 seconds. Any bank, ID or loyalty card works.",
  },
  {
    id: "ruler",
    icon: RulerIcon,
    title: "Measure with a ruler",
    tag: "Most accurate",
    detail: "Needs a ruler at least 10 cm (4 in) long.",
  },
  {
    id: "known",
    icon: TypeIcon,
    title: "I know my screen size",
    detail: "Pick a common size or type the diagonal.",
  },
];

/** First calibration step: choose how, in the user's words. */
export function MethodStep({
  notice,
  cancelLabel,
  onChoose,
  onCancel,
}: {
  /** Pre-check notice; it concerns the two measuring methods. */
  notice: React.ReactNode;
  cancelLabel: string;
  onChoose: (m: Method) => void;
  onCancel: () => void;
}) {
  return (
    <div className={`grid gap-4 ${NARROW_STEP}`}>
      <DialogHeader>
        <DialogTitle>Find your screen size</DialogTitle>
        <DialogDescription className="leading-5">
          The tool needs your screen&rsquo;s real size to show things at
          their true size. Choose how you&rsquo;d like to find it.
        </DialogDescription>
      </DialogHeader>
      {notice}
      <div className="grid gap-2">
        {METHODS.map(({ id, icon: Icon, title, tag, detail }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChoose(id)}
            className={`group flex items-center gap-3 rounded-lg bg-muted/60 px-3 py-2.5 text-left ring-1 ring-foreground/10 hover:bg-muted motion-safe:transition-colors ${FOCUS_RING}`}
          >
            <Icon aria-hidden className="size-5 shrink-0 text-foreground" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{title}</span>
                {tag ? (
                  <span className="text-sm text-muted-foreground">{tag}</span>
                ) : null}
              </span>
              <span className="text-sm text-muted-foreground">{detail}</span>
            </span>
            <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
      <DialogFooter className="sm:justify-start">
        <Button variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
      </DialogFooter>
    </div>
  );
}
