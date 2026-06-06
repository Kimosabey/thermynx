import { useEffect, useMemo, useState } from "react";
import {
  Box, Flex, Text, Grid, Badge, Select, Button, Spinner, useToast, Input, Textarea,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter,
  FormControl, FormLabel, useDisclosure,
} from "@chakra-ui/react";
import { ClipboardList, Plus, Filter, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import GlassCard from "../../shared/ui/GlassCard";
import Eyebrow from "../../shared/ui/Eyebrow";
import GlassSelect from "../../shared/ui/GlassSelect";
import WorkOrderDrawer from "./WorkOrderDrawer";

const MotionBox = motion.create(Box);

const STATE_META = {
  open:        { c: "#0ea5e9", bg: "rgba(14,165,233,0.12)",  b: "rgba(14,165,233,0.32)" },
  assigned:    { c: "#7c3aed", bg: "rgba(124,58,237,0.12)",  b: "rgba(124,58,237,0.32)" },
  in_progress: { c: "#f59e0b", bg: "rgba(245,158,11,0.12)",  b: "rgba(245,158,11,0.32)" },
  resolved:    { c: "#10b981", bg: "rgba(16,185,129,0.12)",  b: "rgba(16,185,129,0.32)" },
  closed:      { c: "#64748b", bg: "rgba(100,116,139,0.12)", b: "rgba(100,116,139,0.32)" },
  cancelled:   { c: "#64748b", bg: "rgba(100,116,139,0.10)", b: "rgba(100,116,139,0.24)" },
};

const PRIORITY_META = {
  low:      { c: "#64748b", bg: "rgba(100,116,139,0.10)" },
  normal:   { c: "#1F3FFE", bg: "rgba(31,63,254,0.10)" },
  high:     { c: "#f59e0b", bg: "rgba(245,158,11,0.14)" },
  critical: { c: "#ef4444", bg: "rgba(239,68,68,0.14)" },
};

const SOURCE_LABEL = { manual: "manual", agent: "agent", anomaly: "anomaly", pm: "PM" };

function StateChip({ state }) {
  const m = STATE_META[state] || STATE_META.open;
  return (
    <Badge fontSize="9px" px={2} py="2px" borderRadius="6px"
      bg={m.bg} color={m.c} border="1px solid" borderColor={m.b}
      textTransform="uppercase" letterSpacing="0.06em">
      {(state || "—").replace("_", " ")}
    </Badge>
  );
}

function PriorityChip({ priority }) {
  const m = PRIORITY_META[priority] || PRIORITY_META.normal;
  return (
    <Badge fontSize="9px" px={2} py="2px" borderRadius="6px"
      bg={m.bg} color={m.c} border="1px solid" borderColor={m.c + "44"}
      textTransform="uppercase" letterSpacing="0.06em">
      {priority}
    </Badge>
  );
}

function StatTile({ label, value, color = "text.primary", delay = 0 }) {
  return (
    <MotionBox initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay }}>
      <GlassCard p={4}>
        <Eyebrow mb={2}>{label}</Eyebrow>
        <Text fontSize="2xl" fontWeight={700} color={color} sx={{ fontVariantNumeric: "tabular-nums" }}>
          {value}
        </Text>
      </GlassCard>
    </MotionBox>
  );
}

function CreateModal({ isOpen, onClose, equipment, onCreated }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [priority, setPriority] = useState("normal");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (title.trim().length < 3) {
      toast({ title: "Title is required", status: "warning", duration: 1800, isClosable: true });
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/v1/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:        title.trim(),
          equipment_id: equipmentId || null,
          priority,
          description:  description.trim() || null,
          created_by:   "operator",
          source:       "manual",
        }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `HTTP ${r.status}`);
      const wo = await r.json();
      toast({ title: "Work order created", description: wo.title, status: "success", duration: 2200, position: "bottom-right" });
      setTitle(""); setEquipmentId(""); setPriority("normal"); setDescription("");
      onCreated?.(wo);
      onClose();
    } catch (e) {
      toast({ title: "Create failed", description: e.message, status: "error", duration: 4000 });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>New work order</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl mb={3} isRequired>
            <FormLabel fontSize="xs" color="text.muted">Title</FormLabel>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Inspect Chiller 1 condenser approach" />
          </FormControl>
          <Grid templateColumns="1fr 160px" gap={3} mb={3}>
            <FormControl>
              <FormLabel fontSize="xs" color="text.muted">Equipment</FormLabel>
              <GlassSelect value={equipmentId} onChange={setEquipmentId} width="100%" placeholder="(none)"
                options={[{ value: "", label: "(none)" }, ...equipment.map(e => ({ value: e.id, label: e.name }))]} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="xs" color="text.muted">Priority</FormLabel>
              <GlassSelect value={priority} onChange={setPriority} width="100%"
                options={[
                  { value: "low", label: "Low" },
                  { value: "normal", label: "Normal" },
                  { value: "high", label: "High" },
                  { value: "critical", label: "Critical" },
                ]} />
            </FormControl>
          </Grid>
          <FormControl>
            <FormLabel fontSize="xs" color="text.muted">Description</FormLabel>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="What needs to happen, why, and any expected outcome…" />
          </FormControl>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button colorScheme="brand" onClick={submit} isLoading={submitting}>Create</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default function WorkOrdersPage() {
  const toast = useToast();
  const createDisc = useDisclosure();

  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterState, setFilterState] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  async function refresh() {
    setLoading(true);
    const q = new URLSearchParams();
    if (filterState)    q.set("state", filterState);
    if (filterPriority) q.set("priority", filterPriority);
    if (filterSource)   q.set("source", filterSource);
    q.set("limit", "200");
    try {
      const [list, st, eq] = await Promise.all([
        fetch(`/api/v1/work-orders?${q.toString()}`).then(r => r.json()),
        fetch(`/api/v1/work-orders/stats`).then(r => r.json()),
        fetch(`/api/v1/equipment`).then(r => r.json()),
      ]);
      setRows(list.rows || []);
      setStats(st);
      setEquipment(eq || []);
    } catch (e) {
      toast({ title: "Failed to load", description: e.message, status: "error", duration: 3000 });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [filterState, filterPriority, filterSource]);

  const counts = stats?.by_state || {};
  const openCount = (counts.open || 0) + (counts.assigned || 0) + (counts.in_progress || 0);

  return (
    <PageShell>
      <PageHeader
        title="Work Orders"
        icon={<PageHeaderIcon icon={<ClipboardList size={20} strokeWidth={1.85} />} />}
        subtitle="Operator tasks — every state change is logged"
        actions={
          <Flex gap={2}>
            <Button leftIcon={<RefreshCw size={14} strokeWidth={2.2} />} size="sm" variant="outline" onClick={refresh}>
              Refresh
            </Button>
            <Button leftIcon={<Plus size={14} strokeWidth={2.2} />} size="sm" colorScheme="brand" onClick={createDisc.onOpen}>
              New
            </Button>
          </Flex>
        }
      />

      {/* Stat tiles */}
      {stats && (
        <Grid templateColumns={{ base: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))", lg: "repeat(5,minmax(0,1fr))" }} gap={4} mb={6}>
          <StatTile label="Total"        value={stats.total ?? 0} delay={0}    />
          <StatTile label="Open / Active" value={openCount}        color="#0ea5e9" delay={0.04} />
          <StatTile label="Resolved/Closed" value={stats.resolved_or_closed ?? 0} color="#10b981" delay={0.08} />
          <StatTile label="MTTR (h)"     value={stats.mttr_hours ?? "—"} delay={0.12} />
          <StatTile label="Repeat-issue rate" value={`${Math.round((stats.repeat_issue_rate ?? 0) * 100)}%`} delay={0.16} />
        </Grid>
      )}

      {/* Filters */}
      <GlassCard p={3} mb={4}>
        <Flex gap={3} align="center" flexWrap="wrap">
          <Flex align="center" gap={2}>
            <Filter size={13} strokeWidth={2} color="#64748b" />
            <Text fontSize="11px" color="text.muted">Filter:</Text>
          </Flex>
          <GlassSelect value={filterState} onChange={setFilterState} width="140px"
            options={[
              { value: "", label: "All states" },
              { value: "open", label: "Open" },
              { value: "assigned", label: "Assigned" },
              { value: "in_progress", label: "In progress" },
              { value: "resolved", label: "Resolved" },
              { value: "closed", label: "Closed" },
              { value: "cancelled", label: "Cancelled" },
            ]} />
          <GlassSelect value={filterPriority} onChange={setFilterPriority} width="130px"
            options={[
              { value: "", label: "Any priority" },
              { value: "critical", label: "Critical" },
              { value: "high", label: "High" },
              { value: "normal", label: "Normal" },
              { value: "low", label: "Low" },
            ]} />
          <GlassSelect value={filterSource} onChange={setFilterSource} width="130px"
            options={[
              { value: "", label: "Any source" },
              { value: "manual", label: "Manual" },
              { value: "agent", label: "Agent" },
              { value: "anomaly", label: "Anomaly" },
              { value: "pm", label: "PM" },
            ]} />
        </Flex>
      </GlassCard>

      {/* List */}
      <GlassCard p={0} overflow="hidden">
        <Box overflowX="auto">
          <Box minW="820px">
            <Grid templateColumns="110px 110px 130px minmax(0,1fr) 100px 100px 80px" gap={3} px={4} py={3} borderBottom="1px solid" borderColor="border.subtle">
              <Eyebrow>State</Eyebrow>
              <Eyebrow>Priority</Eyebrow>
              <Eyebrow>Equipment</Eyebrow>
              <Eyebrow>Title</Eyebrow>
              <Eyebrow>Source</Eyebrow>
              <Eyebrow>When</Eyebrow>
              <Eyebrow textAlign="right">Open</Eyebrow>
            </Grid>
            {loading
              ? <Flex align="center" gap={2} px={4} py={8} justify="center"><Spinner size="sm" /><Text fontSize="xs" color="text.muted">Loading…</Text></Flex>
              : rows.length === 0
                ? <Text px={4} py={8} color="text.muted" fontSize="sm" textAlign="center">No work orders match these filters.</Text>
                : rows.map((wo, i) => (
                    <Grid key={wo.id} templateColumns="110px 110px 130px minmax(0,1fr) 100px 100px 80px" gap={3}
                      px={4} py="10px"
                      borderBottom="1px solid" borderColor="border.subtle"
                      _hover={{ bg: "rgba(31,63,254,0.04)" }}
                      cursor="pointer"
                      onClick={() => setSelectedId(wo.id)}
                    >
                      <StateChip state={wo.state} />
                      <PriorityChip priority={wo.priority} />
                      <Text fontSize="xs" color="text.primary" noOfLines={1}>{wo.equipment_id || "—"}</Text>
                      <Text fontSize="xs" color="text.primary" noOfLines={2}>{wo.title}</Text>
                      <Badge fontSize="9px" bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2} w="fit-content">
                        {SOURCE_LABEL[wo.source] || wo.source}
                      </Badge>
                      <Text fontSize="11px" color="text.muted" sx={{ fontFamily: "mono" }} noOfLines={1}>
                        {wo.created_at?.slice(5, 16).replace("T", " ")}
                      </Text>
                      <Box textAlign="right">
                        <Button size="xs" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedId(wo.id); }}>
                          Open
                        </Button>
                      </Box>
                    </Grid>
                  ))
            }
          </Box>
        </Box>
      </GlassCard>

      {/* Detail drawer */}
      <WorkOrderDrawer
        woId={selectedId}
        equipment={equipment}
        onClose={() => setSelectedId(null)}
        onChanged={refresh}
      />

      {/* Create modal */}
      <CreateModal
        isOpen={createDisc.isOpen}
        onClose={createDisc.onClose}
        equipment={equipment}
        onCreated={refresh}
      />
    </PageShell>
  );
}
