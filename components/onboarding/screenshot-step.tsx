"use client";

import { useRef, useState } from "react";
import { ImageUpIcon, LoaderCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "./views-step";

const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

/**
 * Onboarding's last step: end on the user's own work, not the sample
 * card. Drop, choose (the keyboard path), or paste (handled app-wide by
 * PasteImport, which the parent wires to `importing`/`error` too).
 */
export function ScreenshotStep({
  importing,
  error,
  onFiles,
  onUseSample,
  onBack,
}: {
  importing: boolean;
  error: string | null;
  onFiles: (files: File[]) => void;
  onUseSample: () => void;
  onBack: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const isFileDrag = (e: React.DragEvent) =>
    Array.from(e.dataTransfer.types).includes("Files");

  return (
    <>
      <DialogHeader>
        <DialogTitle>Bring a screenshot</DialogTitle>
        <DialogDescription className="leading-5">
          See your own UI on every screen. It stays in this browser;
          nothing is uploaded.
        </DialogDescription>
      </DialogHeader>
      <div
        // Drops are handled here and stopped: the page's window-wide
        // drop handler would otherwise import the file a second time.
        onDragOver={(e) => {
          if (!isFileDrag(e)) return;
          e.preventDefault();
          e.stopPropagation();
          setOver(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setOver(false);
          }
        }}
        onDrop={(e) => {
          if (!isFileDrag(e)) return;
          e.preventDefault();
          e.stopPropagation();
          setOver(false);
          if (e.dataTransfer.files.length && !importing) {
            onFiles(Array.from(e.dataTransfer.files));
          }
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors motion-reduce:transition-none",
          over ? "border-ring bg-muted" : "border-border",
        )}
      >
        {importing ? (
          <LoaderCircleIcon
            className="size-6 text-muted-foreground motion-safe:animate-spin"
            aria-hidden
          />
        ) : (
          <ImageUpIcon className="size-6 text-muted-foreground" aria-hidden />
        )}
        <p className="text-sm font-medium">
          {importing ? "Importing…" : "Drop a screenshot here"}
        </p>
        <Button
          size="sm"
          disabled={importing}
          onClick={() => inputRef.current?.click()}
        >
          Choose a file…
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            if (e.target.files?.length) onFiles(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
        <p className="text-sm text-muted-foreground">
          or paste it from the clipboard:{" "}
          <Kbd>{IS_MAC ? "⌘" : "Ctrl"}</Kbd>+<Kbd>V</Kbd>
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={importing}>
          Back
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onUseSample}
          disabled={importing}
        >
          Use the sample
        </Button>
      </div>
    </>
  );
}
