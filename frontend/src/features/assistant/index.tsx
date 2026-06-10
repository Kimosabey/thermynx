import { useCallback, useEffect, useRef, useState, type UIEvent } from "react";
import { PanelLeft, ChevronDown } from "lucide-react";
import { NyxAvatar } from "./nyxBranding";
import { useNyxConversation } from "./useNyxConversation";
import type { CitationChunk } from "./useNyxConversation";
import NyxThreadSidebar from "./NyxThreadSidebar";
import NyxComposer from "./NyxComposer";
import UserTurn from "./UserTurn";
import AssistantTurn from "./AssistantTurn";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { CitationDrawer } from "@/features/analyzer/CitationFootnotes";

export default function NyxPage() {
  const { turns, threads, activeThreadId, busy, send, stop, newThread, selectThread } = useNyxConversation();
  const [activeCitation, setActiveCitation] = useState<CitationChunk | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const onOpenCitation = useCallback((c: CitationChunk) => {
    setActiveCitation(c);
    setDrawerOpen(true);
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  // Auto-follow the stream by scrolling ONLY this pane. Never use
  // scrollIntoView here — it bubbles to every scrollable ancestor (incl.
  // Layout's <main>) and, fired ~25×/sec while streaming, yanks the whole
  // page. Direct scrollTop is instant and confined to the stream pane.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const empty = turns.length === 0;

  return (
    <div className="flex h-[calc(100dvh-60px)] flex-col overflow-hidden bg-canvas">
      <div className="flex min-h-0 flex-1">
        {/* sidebar (desktop) */}
        <div className="hidden w-[260px] flex-shrink-0 md:block">
          <NyxThreadSidebar threads={threads} activeThreadId={activeThreadId} onNew={newThread} onSelect={selectThread} />
        </div>

        {/* main column */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          {/* header */}
          <div className="flex flex-shrink-0 items-center gap-2.5 border-b border-border-subtle px-5 py-3">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Open conversations"
              className="inline-flex md:hidden"
              onClick={() => setNavOpen(true)}
            >
              <PanelLeft size={18} />
            </Button>
            <NyxAvatar size="30px" icon={17} />
            <div>
              <h1 className="text-[15px] leading-[1.1] font-extrabold text-ink">Nyx</h1>
              <p className="text-[10px] text-ink-muted">HVAC operations assistant · auto-routes to the right engine</p>
            </div>
          </div>

          {/* stream */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3 py-5 md:px-6 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[rgba(31,63,254,0.25)]"
            onScroll={(e: UIEvent<HTMLDivElement>) => {
              const el = e.currentTarget;
              setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
            }}
          >
            <div className="mx-auto max-w-4xl">
              {empty ? (
                <div className="flex min-h-[52vh] flex-col items-center justify-center text-center">
                  <NyxAvatar size="48px" icon={26} />
                  <h2 className="mt-4 mb-2 text-2xl font-bold text-ink">How can I help, operator?</h2>
                  <p className="max-w-md text-sm text-ink-muted">
                    Ask anything about the plant — Nyx figures out whether to answer directly, investigate with tools,
                    query the data, or coordinate specialists.
                  </p>
                </div>
              ) : (
                turns.map((t) =>
                  t.role === "user" ? (
                    <UserTurn key={t.id} text={t.text} />
                  ) : (
                    <AssistantTurn key={t.id} turn={t} onOpenCitation={onOpenCitation} />
                  ),
                )
              )}
            </div>
          </div>

          {/* jump to latest — only while streaming and scrolled away from the bottom */}
          {busy && !atBottom && (
            <Button
              size="sm"
              className="absolute bottom-[92px] left-1/2 z-[2] -translate-x-1/2 rounded-full shadow-md"
              onClick={() => {
                const el = scrollRef.current;
                if (el) el.scrollTop = el.scrollHeight;
              }}
            >
              <ChevronDown size={14} strokeWidth={2.2} />
              Latest
            </Button>
          )}

          {/* composer */}
          <div className="flex-shrink-0 px-3 pt-2 pb-4 md:px-6">
            <NyxComposer onSend={send} busy={busy} onStop={stop} showSuggestions={empty} />
          </div>
        </div>
      </div>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-[280px] max-w-[280px] p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Conversations</SheetTitle>
          <SheetDescription className="sr-only">Your Nyx conversation threads.</SheetDescription>
          <NyxThreadSidebar
            threads={threads}
            activeThreadId={activeThreadId}
            onNew={() => {
              newThread();
              setNavOpen(false);
            }}
            onSelect={(id) => {
              selectThread(id);
              setNavOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>

      <CitationDrawer chunk={activeCitation} isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
