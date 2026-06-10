import { useState, useRef, type KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";
import GlassCard from "@/shared/ui/GlassCard";
import Chip from "@/shared/ui/Chip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ModeChip from "./ModeChip";
import { buildAnalyzerPrompts } from "@/shared/ai/promptTemplates";

export interface NyxComposerProps {
  onSend: (message: string, forcedEngine?: string | null) => void;
  busy: boolean;
  onStop: () => void;
  showSuggestions: boolean;
}

export default function NyxComposer({ onSend, busy, onStop, showSuggestions }: NyxComposerProps) {
  const [text, setText] = useState("");
  const [forced, setForced] = useState<string | null>(null); // null = Auto
  const taRef = useRef<HTMLTextAreaElement>(null);
  const suggestions = showSuggestions ? buildAnalyzerPrompts(null).slice(0, 4) : [];

  function submit(msg?: string) {
    const m = (msg ?? text).trim();
    if (!m || busy) return;
    onSend(m, forced);
    setText("");
    // Send BUTTON click leaves focus on the now-disabled button; return it to the input.
    requestAnimationFrame(() => taRef.current?.focus());
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      {suggestions.length > 0 && !busy && (
        <div className="mb-3 flex flex-wrap justify-center gap-2">
          {suggestions.map((s, i) => (
            <Chip key={i} className="max-w-full md:max-w-none" onClick={() => submit(s)}>
              {s}
            </Chip>
          ))}
        </div>
      )}
      <GlassCard
        hover={false}
        className="rounded-xl p-3"
        style={{ boxShadow: "0 -4px 30px rgba(0,0,0,0.1)" }}
      >
        <Textarea
          ref={taRef}
          value={text}
          aria-label="Message Nyx"
          aria-keyshortcuts="Control+Enter Meta+Enter"
          disabled={busy}
          onChange={(e) => setText(e.target.value.slice(0, 2000))}
          onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
          }}
          placeholder="Message Nyx…  (Ctrl/Cmd+Enter to send)"
          rows={1}
          maxLength={2000}
          className="max-h-[160px] min-h-[40px] resize-y border-none bg-transparent p-1 text-sm text-ink shadow-none placeholder:text-ink-muted focus-visible:shadow-none focus-visible:ring-0"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2">
          <div className="flex items-center gap-2">
            <ModeChip forced={forced} onChange={setForced} />
            <span className="text-[10px] tabular-nums text-ink-faint" aria-live="polite">
              {text.length}/2000
            </span>
          </div>
          <div className="flex items-center gap-2">
            {busy && (
              <Button
                size="xs"
                variant="ghost"
                onClick={onStop}
                className="min-h-[40px] rounded-md md:min-h-[32px]"
              >
                Stop
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => submit()}
              disabled={busy || !text.trim()}
              className="min-h-[40px] rounded-[10px] px-4 text-xs font-semibold md:min-h-[32px]"
            >
              Send
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={2.2} />}
            </Button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
