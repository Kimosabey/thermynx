import { Plus, MessageSquare } from "lucide-react";
import Eyebrow from "@/shared/ui/Eyebrow";
import { Button } from "@/components/ui/button";
import type { ThreadSummary } from "./useNyxConversation";

export interface NyxThreadSidebarProps {
  threads: ThreadSummary[];
  activeThreadId: string;
  onNew: () => void;
  onSelect: (id: string) => void;
}

export default function NyxThreadSidebar({ threads, activeThreadId, onNew, onSelect }: NyxThreadSidebarProps) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden border-r border-border-subtle bg-surface">
      <div className="p-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onNew}
          className="w-full rounded-[10px] border-brand text-brand hover:bg-[var(--glow)] hover:text-brand"
        >
          <Plus size={15} strokeWidth={2.2} />
          New chat
        </Button>
      </div>
      <div className="px-3 pb-2">
        <Eyebrow>Conversations</Eyebrow>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {threads.length === 0 && <p className="px-2 text-xs text-ink-faint">No conversations yet.</p>}
        {threads.map((t) => {
          const active = t.id === activeThreadId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              aria-current={active ? "true" : undefined}
              aria-label={t.title || "Untitled conversation"}
              className={
                "mb-1 flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-elevated hover:text-ink " +
                (active ? "bg-[var(--glow)] text-ink-brand" : "bg-transparent text-ink-secondary")
              }
            >
              <MessageSquare size={13} strokeWidth={2} />
              <span className="line-clamp-1 flex-1 text-[13px]">{t.title || t.id.slice(0, 8)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
