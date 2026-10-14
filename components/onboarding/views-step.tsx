"use client";

import { BoxIcon, SquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** A key cap for inline shortcut hints. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1 font-mono text-xs text-foreground">
      {children}
    </kbd>
  );
}

const VIEWS = [
  {
    icon: SquareIcon,
    name: "2D",
    body: "Your image at every device's true relative size, side by side on the screen in front of you.",
  },
  {
    icon: BoxIcon,
    name: "3D",
    body: "The same screens in a room, at their real distances from where you sit.",
  },
] as const;

/** Onboarding step 4: the two views and how to switch between them. */
export function ViewsStep({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Two views</DialogTitle>
        <DialogDescription>
          Same displays, same angular sizes, two ways to look at them.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-2.5">
        {VIEWS.map(({ icon: Icon, name, body }) => (
          <div key={name} className="panel-inset space-y-1 rounded-md p-2.5">
            <div className="flex items-center gap-1.5 font-medium">
              <Icon className="size-4" aria-hidden /> {name}
            </div>
            <p className="text-sm leading-4.5 text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
      <p className="text-sm leading-4.5 text-muted-foreground">
        Switch with the <span className="font-medium text-foreground">2D | 3D</span>{" "}
        toggle at the top of the screen, or press <Kbd>V</Kbd>.
      </p>
      <div className="flex justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
        <Button size="sm" onClick={onNext}>
          Next
        </Button>
      </div>
    </>
  );
}
