import { ChevronDown, Check, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { NYX_MODES, MODE_IDS, modeMeta } from "./nyxModes";

export interface ModeChipProps {
  engine?: string;
  readOnly?: boolean;
  forced?: string | null;
  onChange?: (id: string | null) => void;
}

/**
 * Mode chip. readOnly → static label of the engine that ran a turn.
 * Interactive (composer) → shows current forced mode or "Auto", dropdown to
 * force one of the 8 engines (or back to Auto = null).
 */
export default function ModeChip({ engine, readOnly = false, forced = null, onChange }: ModeChipProps) {
  if (readOnly) {
    const m = modeMeta(engine);
    const Icon = m.Icon;
    return (
      <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border-subtle bg-chip px-2 py-[2px]">
        <span style={{ color: m.color }}>
          <Icon size={12} strokeWidth={2.2} />
        </span>
        <span className="text-[10px] font-bold text-ink-secondary">{m.label}</span>
      </div>
    );
  }

  const active = forced ? modeMeta(forced) : null;
  const ActiveIcon = active ? active.Icon : Wand2;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 rounded-full px-2 hover:bg-elevated md:h-7"
          style={{ color: active ? active.color : "var(--ink-muted)" }}
        >
          <span className="flex items-center gap-1.5">
            <ActiveIcon size={13} strokeWidth={2} />
            <span className="text-[11px] font-bold">{active ? active.label : "Auto"}</span>
          </span>
          <ChevronDown size={12} strokeWidth={2} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={6}
        className="max-h-[320px] w-auto min-w-[200px] overflow-y-auto rounded-[14px] border-border-subtle bg-surface py-[6px] shadow-xl"
      >
        <DropdownMenuItem
          onSelect={() => onChange?.(null)}
          className="mx-[6px] rounded-[10px] px-[10px] py-[8px] text-[13px] focus:bg-elevated"
          style={!forced ? { backgroundColor: "var(--glow)" } : undefined}
        >
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <Wand2 size={14} /> <span>Auto (let Nyx decide)</span>
            </div>
            {!forced && <Check size={14} />}
          </div>
        </DropdownMenuItem>
        {MODE_IDS.map((id) => {
          const m = NYX_MODES[id];
          const Icon = m.Icon;
          const on = forced === id;
          return (
            <DropdownMenuItem
              key={id}
              onSelect={() => onChange?.(id)}
              className="mx-[6px] rounded-[10px] px-[10px] py-[8px] text-[13px] focus:bg-elevated"
              style={on ? { backgroundColor: "var(--glow)" } : undefined}
            >
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <span style={{ color: m.color }}>
                    <Icon size={14} />
                  </span>{" "}
                  <span>{m.label}</span>
                </div>
                {on && <Check size={14} />}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
