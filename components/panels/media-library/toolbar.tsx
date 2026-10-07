"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FolderDownIcon, SparklesIcon, UploadIcon } from "lucide-react";
import { GENERATED_KINDS, useMediaStore } from "@/stores/media-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Sample images are a gitignored dev convenience: a manifest at
 * `public/reference/manifest.json` listing image filenames. If it isn't
 * there (any error, non-200, or empty), the action simply never appears.
 */
function normalizeManifest(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object") {
        const file = (entry as { file?: unknown }).file;
        if (typeof file === "string") return file;
      }
      return null;
    })
    .filter((n): n is string => !!n);
}

function useSampleManifest(): string[] | null {
  const [names, setNames] = useState<string[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE_PATH}/reference/manifest.json`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const list = normalizeManifest(await res.json());
        if (!cancelled && list.length > 0) setNames(list);
      } catch {
        // No samples available — the action stays hidden.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return names;
}

/**
 * One slim row: import, generated test images, samples. Dropping files
 * anywhere on the app window already imports them, so no dropzone.
 */
export function Toolbar() {
  const addFiles = useMediaStore((s) => s.addFiles);
  const addGenerated = useMediaStore((s) => s.addGenerated);
  const items = useMediaStore((s) => s.items);
  const inputRef = useRef<HTMLInputElement>(null);
  const samples = useSampleManifest();
  const [loadingSamples, setLoadingSamples] = useState(false);

  const loadSamples = useCallback(async () => {
    if (!samples || loadingSamples) return;
    setLoadingSamples(true);
    try {
      const existing = new Set(items.map((i) => i.name));
      const wanted = samples.filter((n) => !existing.has(n));
      const files: File[] = [];
      for (const name of wanted) {
        try {
          const path = name.split("/").map(encodeURIComponent).join("/");
          const res = await fetch(`${BASE_PATH}/reference/${path}`);
          if (!res.ok) continue;
          const blob = await res.blob();
          files.push(new File([blob], name, { type: blob.type || "image/png" }));
        } catch {
          // Skip any file that fails to load.
        }
      }
      if (files.length > 0) await addFiles(files);
    } finally {
      setLoadingSamples(false);
    }
  }, [samples, loadingSamples, items, addFiles]);

  return (
    <div className="flex items-center gap-1.5 p-2.5">
      <Button
        variant="secondary"
        size="sm"
        className="flex-1"
        title="Import images or videos (or drop them anywhere in the window)"
        onClick={() => inputRef.current?.click()}
      >
        <UploadIcon className="size-4" /> Import
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              title="Add a generated test image"
            >
              <SparklesIcon className="size-4" /> Test
            </Button>
          }
        />
        <DropdownMenuContent className="w-44">
          {GENERATED_KINDS.map((k) => (
            <DropdownMenuItem
              key={k.kind}
              onClick={() => void addGenerated(k.kind)}
            >
              {k.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {samples ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          title="Import the local sample screenshots"
          disabled={loadingSamples}
          onClick={() => void loadSamples()}
        >
          <FolderDownIcon className="size-4" />
          {loadingSamples ? "…" : "Samples"}
        </Button>
      ) : null}
    </div>
  );
}
