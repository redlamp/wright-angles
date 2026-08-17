"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Destructive action needing a second click: the first turns the button
 * into "Confirm" (solid red); it disarms on blur. Shared by the Media
 * Library's and Perception Report's clear controls.
 */
export function ConfirmButton({
  label,
  title,
  onConfirm,
}: {
  label: string;
  title: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <Button
      variant={armed ? "destructive" : "ghost"}
      size="sm"
      className={cn(
        "h-6 px-1.5 text-xs",
        !armed &&
          "text-destructive hover:bg-destructive/10 hover:text-destructive",
      )}
      title={armed ? `Click again to ${label.toLowerCase()}` : title}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? "Confirm" : label}
    </Button>
  );
}
