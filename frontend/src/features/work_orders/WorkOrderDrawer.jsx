import { useEffect, useState } from "react";
import {
  Box, Flex, Text, Badge, Drawer, DrawerOverlay, DrawerContent, DrawerCloseButton,
  DrawerHeader, DrawerBody, Spinner, Button, Select, Textarea, useToast, FormControl,
  FormLabel, Divider,
} from "@chakra-ui/react";
import {
  CheckCircle2, Play, Pause, XCircle, UserCog, MessageSquare, Sparkles,
} from "lucide-react";
import GlassCard from "../../shared/ui/GlassCard";
import Eyebrow from "../../shared/ui/Eyebrow";
import { surfaceSelectProps } from "../../shared/ui/PeriodSelect";

const STATE_LABEL = {
  open: "Open", assigned: "Assigned", in_progress: "In progress",
  resolved: "Resolved", closed: "Closed", cancelled: "Cancelled",
};

// Allowed transitions client-side (mirror of the backend state machine)
const NEXT_STATES = {
  open:        [{ to: "in_progress", label: "Start work",  Icon: Play },        { to: "cancelled",  label: "Cancel", Icon: XCircle }],
  assigned:    [{ to: "in_progress", label: "Start work",  Icon: Play },        { to: "cancelled",  label: "Cancel", Icon: XCircle }],
  in_progress: [{ to: "resolved",    label: "Mark resolved", Icon: CheckCircle2 }, { to: "assigned", label: "Pause", Icon: Pause }],
  resolved:    [{ to: "closed",      label: "Close",        Icon: CheckCircle2 }, { to: "in_progress", label: "Re-open", Icon: Play }],
  closed:      [],
  cancelled:   [],
};

const PRIORITY_BG = {
  low:      { c: "#64748b", bg: "rgba(100,116,139,0.10)" },
  normal:   { c: "#1F3FFE", bg: "rgba(31,63,254,0.10)" },
  high:     { c: "#f59e0b", bg: "rgba(245,158,11,0.14)" },
  critical: { c: "#ef4444", bg: "rgba(239,68,68,0.14)" },
};

function TimelineEvent({ ev }) {
  const kind = ev.kind;
  const kindColor = kind === "transition" ? "#1F3FFE"
                  : kind === "comment"    ? "#0ea5e9"
                  : kind === "assignment" ? "#7c3aed"
                  : "#64748b";
  return (
    <Flex gap={3} pb={3} position="relative">
      <Box w="8px" h="8px" borderRadius="full" bg={kindColor} mt="6px" flexShrink={0}
        boxShadow={`0 0 0 3px ${kindColor}22`} />
      <Box flex="1" minW={0}>
        <Flex align="center" gap={2}>
          <Badge fontSize="9px" bg="bg.chip" border="1px solid" borderColor="border.subtle" color={kindColor} borderRadius="6px" px={2} py="2px" textTransform="uppercase" letterSpacing="0.06em">
            {kind}
          </Badge>
          {ev.from_state && ev.to_state && (
            <Text fontSize="11px" color="text.muted">
              {STATE_LABEL[ev.from_state]} → <Text as="span" color="text.primary" fontWeight={700}>{STATE_LABEL[ev.to_state]}</Text>
            </Text>
          )}
          <Text ml="auto" fontSize="10px" color="text.muted" sx={{ fontFamily: "mono" }}>
            {ev.created_at?.replace("T", " ").slice(0, 19)}
          </Text>
        </Flex>
        {ev.notes && (
          <Text fontSize="xs" color="text.primary" mt={1}>{ev.notes}</Text>
        )}
        {ev.actor && (
          <Text fontSize="10px" color="text.muted" mt={1}>by {ev.actor}</Text>
        )}
      </Box>
    </Flex>
  );
}

export default function WorkOrderDrawer({ woId, equipment, onClose, onChanged }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [technicians, setTechnicians] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [commentText, setCommentText] = useState("");

  async function load() {
    if (!woId) return;
    setLoading(true);
    try {
      const [d, t] = await Promise.all([
        fetch(`/api/v1/work-orders/${woId}`).then(r => r.json()),
        fetch(`/api/v1/technicians`).then(r => r.json()),
      ]);
      setData(d);
      setTechnicians(t.technicians || []);
    } catch (e) {
      toast({ title: "Failed to load", description: e.message, status: "error", duration: 3000 });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [woId]);

  async function transition(toState, notes) {
    try {
      const r = await fetch(`/api/v1/work-orders/${woId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_state: toState, actor: "operator", notes }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `HTTP ${r.status}`);
      await load();
      onChanged?.();
      toast({ title: `Moved to ${STATE_LABEL[toState]}`, status: "success", duration: 1800, position: "bottom-right" });
    } catch (e) {
      toast({ title: "Transition failed", description: e.message, status: "error", duration: 3500 });
    }
  }

  async function assign(techId) {
    try {
      const r = await fetch(`/api/v1/work-orders/${woId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ technician_id: techId || null, actor: "operator" }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `HTTP ${r.status}`);
      await load();
      onChanged?.();
      toast({ title: techId ? "Assigned" : "Unassigned", status: "success", duration: 1800, position: "bottom-right" });
    } catch (e) {
      toast({ title: "Assign failed", description: e.message, status: "error", duration: 3500 });
    }
  }

  async function suggest() {
    setSuggesting(true);
    setSuggestions([]);
    try {
      const r = await fetch(`/api/v1/technicians/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ work_order_id: woId, top_k: 3 }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setSuggestions(j.suggestions || []);
      if ((j.suggestions || []).length === 0) {
        toast({ title: "No suggestions", description: j.note || "Model returned empty", status: "info", duration: 2400 });
      }
    } catch (e) {
      toast({ title: "Suggest failed", description: e.message, status: "error", duration: 3500 });
    } finally {
      setSuggesting(false);
    }
  }

  async function comment() {
    if (!commentText.trim()) return;
    try {
      const r = await fetch(`/api/v1/work-orders/${woId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: commentText.trim(), actor: "operator" }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `HTTP ${r.status}`);
      setCommentText("");
      await load();
      onChanged?.();
    } catch (e) {
      toast({ title: "Comment failed", description: e.message, status: "error", duration: 3500 });
    }
  }

  const wo = data?.work_order;
  const events = data?.events || [];
  const eqMap = Object.fromEntries((equipment || []).map(e => [e.id, e]));
  const techMap = Object.fromEntries(technicians.map(t => [t.id, t]));

  const isOpen = !!woId;
  const transitions = wo ? NEXT_STATES[wo.state] || [] : [];
  const prio = wo ? (PRIORITY_BG[wo.priority] || PRIORITY_BG.normal) : null;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} placement="right" size="md">
      <DrawerOverlay />
      <DrawerContent bg="bg.surface">
        <DrawerCloseButton />
        <DrawerHeader>
          {loading || !wo
            ? <Spinner size="sm" />
            : (
              <Box>
                <Flex align="center" gap={2} mb={2} flexWrap="wrap">
                  <Badge fontSize="9px" px={2} py="2px" borderRadius="6px"
                    bg={prio.bg} color={prio.c} border="1px solid" borderColor={prio.c + "44"}
                    textTransform="uppercase" letterSpacing="0.06em">
                    {wo.priority}
                  </Badge>
                  <Badge fontSize="9px" px={2} py="2px" borderRadius="6px"
                    bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle"
                    textTransform="uppercase" letterSpacing="0.06em">
                    {wo.source}
                  </Badge>
                  <Badge fontSize="9px" px={2} py="2px" borderRadius="6px"
                    bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle">
                    {STATE_LABEL[wo.state]}
                  </Badge>
                </Flex>
                <Text fontSize="md" fontWeight={700} color="text.primary">{wo.title}</Text>
                {wo.equipment_id && (
                  <Text fontSize="xs" color="text.muted" mt={1}>
                    {eqMap[wo.equipment_id]?.name || wo.equipment_id}
                  </Text>
                )}
              </Box>
            )
          }
        </DrawerHeader>
        <DrawerBody>
          {!loading && wo && (
            <Box>
              {/* Transitions */}
              {transitions.length > 0 && (
                <Box mb={4}>
                  <Eyebrow mb={2}>Actions</Eyebrow>
                  <Flex gap={2} flexWrap="wrap">
                    {transitions.map(t => (
                      <Button
                        key={t.to}
                        size="sm"
                        leftIcon={<t.Icon size={12} strokeWidth={2.2} />}
                        onClick={() => transition(t.to)}
                        variant={t.to === "resolved" || t.to === "closed" ? "solid" : "outline"}
                        colorScheme={t.to === "cancelled" ? "red" : "brand"}
                      >
                        {t.label}
                      </Button>
                    ))}
                  </Flex>
                </Box>
              )}

              {/* Description */}
              {wo.description && (
                <Box mb={4}>
                  <Eyebrow mb={2}>Description</Eyebrow>
                  <Text fontSize="sm" color="text.primary" whiteSpace="pre-wrap">{wo.description}</Text>
                </Box>
              )}

              {/* AI diagnosis (when present — populated by agent/anomaly source) */}
              {(wo.diagnosis || wo.recommended_actions) && (
                <GlassCard p={3} mb={4}>
                  {wo.diagnosis && (
                    <Box mb={wo.recommended_actions ? 3 : 0}>
                      <Eyebrow mb={1}>Diagnosis</Eyebrow>
                      <Text fontSize="sm" color="text.primary" whiteSpace="pre-wrap">{wo.diagnosis}</Text>
                    </Box>
                  )}
                  {wo.recommended_actions && (
                    <Box>
                      <Eyebrow mb={1}>Recommended actions</Eyebrow>
                      <Text fontSize="sm" color="text.primary" whiteSpace="pre-wrap">{wo.recommended_actions}</Text>
                    </Box>
                  )}
                </GlassCard>
              )}

              {/* Assignment */}
              <Box mb={4}>
                <Flex align="center" justify="space-between" mb={2}>
                  <Eyebrow>Assigned technician</Eyebrow>
                  <Button size="xs" variant="ghost" leftIcon={<Sparkles size={11} strokeWidth={2.2} />} onClick={suggest} isLoading={suggesting}>
                    Suggest
                  </Button>
                </Flex>
                <FormControl>
                  <Select size="sm" value={wo.assigned_to || ""} onChange={e => assign(e.target.value)} {...surfaceSelectProps}>
                    <option value="">Unassigned</option>
                    {technicians.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}{t.skills?.length ? ` — ${t.skills.slice(0,3).join(", ")}` : ""}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                {suggestions.length > 0 && (
                  <Box mt={2}>
                    {suggestions.map((s, i) => (
                      <Flex key={i} align="flex-start" gap={2} py={2} px={2} borderRadius="8px"
                        bg="bg.chip" border="1px solid" borderColor="border.subtle" mb={1}
                      >
                        <Box flex="1">
                          <Flex align="center" gap={2}>
                            <Text fontSize="xs" fontWeight={700}>{s.technician.name}</Text>
                            {s.score != null && (
                              <Badge fontSize="9px" bg="rgba(16,185,129,0.12)" color="#10b981" border="1px solid rgba(16,185,129,0.32)" borderRadius="6px" px={2}>
                                {Number(s.score).toFixed(2)}
                              </Badge>
                            )}
                          </Flex>
                          {s.reason && <Text fontSize="11px" color="text.muted" mt="2px">{s.reason}</Text>}
                        </Box>
                        <Button size="xs" variant="outline" leftIcon={<UserCog size={11} />} onClick={() => assign(s.technician.id)}>
                          Assign
                        </Button>
                      </Flex>
                    ))}
                  </Box>
                )}
              </Box>

              <Divider mb={4} />

              {/* Comment box */}
              <Box mb={4}>
                <Eyebrow mb={2}>Add a comment</Eyebrow>
                <Textarea size="sm" rows={2} value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Notes for the next operator…" mb={2} />
                <Flex justify="flex-end">
                  <Button size="sm" leftIcon={<MessageSquare size={12} />} onClick={comment} isDisabled={!commentText.trim()}>
                    Post
                  </Button>
                </Flex>
              </Box>

              {/* Timeline */}
              <Box>
                <Eyebrow mb={3}>Timeline ({events.length})</Eyebrow>
                <Box pl={1}>
                  {events.map(ev => <TimelineEvent key={ev.id} ev={ev} />)}
                </Box>
              </Box>
            </Box>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
