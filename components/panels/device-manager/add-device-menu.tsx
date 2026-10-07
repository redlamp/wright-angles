"use client";

import { useMemo } from "react";
import { PlusIcon } from "lucide-react";
import { DEVICE_PRESETS } from "@/lib/presets";
import { useDeviceStore } from "@/stores/device-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CATEGORY_LABELS: Record<string, string> = {
  handheld: "Handhelds",
  phone: "Phones",
  tablet: "Tablets",
  monitor: "Monitors",
  tv: "TVs",
  projector: "Projectors",
  custom: "Generic",
};

export function AddDeviceMenu() {
  const addFromPreset = useDeviceStore((s) => s.addFromPreset);
  const groups = useMemo(() => {
    const order = [
      "handheld",
      "phone",
      "tablet",
      "monitor",
      "tv",
      "projector",
      "custom",
    ];
    return order
      .map((cat) => ({
        cat,
        presets: DEVICE_PRESETS.filter((p) => p.category === cat),
      }))
      .filter((g) => g.presets.length > 0);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="secondary" size="sm" className="w-full">
            <PlusIcon className="size-4" /> Add device
          </Button>
        }
      />
      <DropdownMenuContent className="max-h-96 w-60 overflow-y-auto">
        {groups.map((g, i) => (
          <DropdownMenuGroup key={g.cat}>
            {i > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="text-sm tracking-wide text-muted-foreground uppercase">
              {CATEGORY_LABELS[g.cat]}
            </DropdownMenuLabel>
            {g.presets.map((p) => (
              <DropdownMenuItem
                key={p.presetId}
                onClick={() => addFromPreset(p)}
              >
                <span className="flex-1">{p.label}</span>
                <span className="font-mono text-sm text-muted-foreground">
                  {p.resolution.w}×{p.resolution.h}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
