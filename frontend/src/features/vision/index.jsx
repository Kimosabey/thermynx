import { useState, useRef } from "react";
import {
  Box, Flex, Text, Button, Grid, Spinner, Image, Badge, useToast,
} from "@chakra-ui/react";
import { Camera, Upload, Play, AlertCircle, Eye, GitCompare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import GlassCard from "../../shared/ui/GlassCard";
import Eyebrow from "../../shared/ui/Eyebrow";

const MotionBox = motion.create(Box);

const SEV = {
  critical: { c: "#ef4444", bg: "rgba(239,68,68,0.12)",  b: "rgba(239,68,68,0.32)" },
  warning:  { c: "#f59e0b", bg: "rgba(245,158,11,0.12)", b: "rgba(245,158,11,0.32)" },
  info:     { c: "#0ea5e9", bg: "rgba(14,165,233,0.12)", b: "rgba(14,165,233,0.32)" },
};

function SeverityChip({ severity }) {
  const s = SEV[severity] || SEV.info;
  return (
    <Box px={2} py="2px" borderRadius="6px" bg={s.bg} border="1px solid" borderColor={s.b}
      color={s.c} fontSize="10px" fontWeight={700} textTransform="uppercase" letterSpacing="0.06em"
      w="fit-content">
      {severity}
    </Box>
  );
}

function asText(v) {
  // LLMs occasionally return arrays of {severity, description} objects instead of
  // plain strings. Render gracefully either way.
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(asText).join(" · ");
  if (typeof v === "object") {
    const text = v.text ?? v.message ?? v.description ?? v.detail;
    if (text) return typeof text === "string" ? text : asText(text);
    return Object.entries(v).map(([k, val]) => `${k}: ${asText(val)}`).join(" · ");
  }
  return String(v);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function DropZone({ label, image, onPick, disabled }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);

  async function handleFiles(files) {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const b64 = await fileToBase64(file);
    onPick({ b64, name: file.name, size: file.size, preview: b64 });
  }

  return (
    <Box
      as="label"
      htmlFor={`drop-${label}`}
      cursor={disabled ? "not-allowed" : "pointer"}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); if (!disabled) handleFiles(e.dataTransfer.files); }}
    >
      <GlassCard
        p={0}
        overflow="hidden"
        borderColor={drag ? "border.brand" : "border.subtle"}
        transition="border-color 0.18s"
        h="240px"
        display="flex"
        alignItems="center"
        justifyContent="center"
        position="relative"
      >
        {image?.preview
          ? (
            <Box position="relative" w="100%" h="100%">
              <Image src={image.preview} alt={label} w="100%" h="100%" objectFit="cover" />
              <Box position="absolute" left={2} top={2} bg="bg.glass" backdropFilter="blur(8px)"
                border="1px solid" borderColor="border.subtle" borderRadius="8px" px={2} py="2px">
                <Text fontSize="10px" fontWeight={700} color="text.primary">{label}</Text>
              </Box>
            </Box>
          )
          : (
            <Flex direction="column" align="center" gap={2} color="text.muted">
              <Upload size={28} strokeWidth={1.6} />
              <Text fontSize="sm" fontWeight={600} color="text.primary">{label}</Text>
              <Text fontSize="xs">Click or drop a photo</Text>
            </Flex>
          )
        }
      </GlassCard>
      <input
        ref={inputRef}
        id={`drop-${label}`}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        disabled={disabled}
        onChange={e => handleFiles(e.target.files)}
      />
    </Box>
  );
}

export default function VisionPage() {
  const toast = useToast();
  const [ref, setRef]       = useState(null);
  const [cur, setCur]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);
  const [mode, setMode]       = useState("compare"); // "describe" | "compare"

  async function run() {
    setError(null); setResult(null);
    if (mode === "describe" && !cur) { setError("Add a current photo first."); return; }
    if (mode === "compare" && (!ref || !cur)) { setError("Add both reference and current photos."); return; }
    setLoading(true);
    try {
      const url  = mode === "describe" ? "/api/v1/vision/describe" : "/api/v1/vision/compare";
      const body = mode === "describe"
        ? { image: cur.b64 }
        : { reference: ref.b64, current: cur.b64 };
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data?.detail || `HTTP ${r.status}`);
      }
      const data = await r.json();
      setResult(data);
      toast({
        title: `${mode === "describe" ? "Scene described" : "Comparison done"} in ${data.elapsed_ms}ms`,
        status: "success", duration: 2500, isClosable: true, position: "bottom-right",
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Vision Compare"
        icon={<PageHeaderIcon icon={<Camera size={20} strokeWidth={1.85} />} />}
        subtitle="Upload a plant photo — on-prem vision model describes or diffs against a reference"
        actions={
          <Flex gap={2}>
            <Button
              size="sm"
              variant={mode === "describe" ? "solid" : "outline"}
              leftIcon={<Eye size={14} strokeWidth={2.2} />}
              onClick={() => { setMode("describe"); setResult(null); setError(null); }}
            >
              Describe
            </Button>
            <Button
              size="sm"
              variant={mode === "compare" ? "solid" : "outline"}
              leftIcon={<GitCompare size={14} strokeWidth={2.2} />}
              onClick={() => { setMode("compare"); setResult(null); setError(null); }}
            >
              Compare
            </Button>
          </Flex>
        }
      />

      <Grid templateColumns={mode === "compare" ? { base: "1fr", md: "1fr 1fr" } : { base: "1fr" }} gap={4} mb={4}>
        {mode === "compare" && (
          <DropZone label="Reference" image={ref} onPick={setRef} disabled={loading} />
        )}
        <DropZone label="Current" image={cur} onPick={setCur} disabled={loading} />
      </Grid>

      <Flex justify="space-between" align="center" mb={6} wrap="wrap" gap={3}>
        <Text fontSize="11px" color="text.muted">
          All processing on the on-prem Ollama server. No cloud APIs. Max 6 MiB per image.
        </Text>
        <Button
          leftIcon={loading ? <Spinner size="xs" /> : <Play size={14} strokeWidth={2.2} />}
          onClick={run}
          isDisabled={loading || (mode === "describe" ? !cur : !ref || !cur)}
          colorScheme="brand"
          size="sm"
        >
          {loading ? "Analyzing…" : "Analyze"}
        </Button>
      </Flex>

      {error && (
        <MotionBox initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard p={4} mb={4} borderColor="rgba(239,68,68,0.32)" border="1px solid">
            <Flex align="center" gap={3}>
              <Box color="status.bad"><AlertCircle size={18} /></Box>
              <Box>
                <Eyebrow color="#ef4444">Vision call failed</Eyebrow>
                <Text fontSize="sm" color="text.primary" mt={1}>{error}</Text>
              </Box>
            </Flex>
          </GlassCard>
        </MotionBox>
      )}

      <AnimatePresence>
        {result && (
          <MotionBox initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <GlassCard p={5} mb={4}>
              <Flex align="center" gap={3} mb={3} wrap="wrap">
                <Eyebrow>Verdict</Eyebrow>
                <SeverityChip severity={result.severity} />
                <Badge ml="auto" fontSize="9px" bg="bg.chip" color="text.muted" border="1px solid" borderColor="border.subtle" borderRadius="6px" px={2}>
                  {result.model} · {result.elapsed_ms}ms
                </Badge>
              </Flex>
              <Text fontSize="sm" color="text.primary" mb={3}>{asText(result.description)}</Text>

              {result.differences?.length > 0 && (
                <Box mb={3}>
                  <Eyebrow mb={2}>Differences</Eyebrow>
                  {result.differences.map((d, i) => (
                    <Flex key={i} align="flex-start" gap={2} py={1}>
                      <Box w="6px" h="6px" mt="6px" borderRadius="full" bg="#f59e0b" flexShrink={0} />
                      <Text fontSize="sm" color="text.primary">{asText(d)}</Text>
                    </Flex>
                  ))}
                </Box>
              )}

              {result.findings?.length > 0 && (
                <Box>
                  <Eyebrow mb={2}>Findings</Eyebrow>
                  {result.findings.map((f, i) => (
                    <Flex key={i} align="flex-start" gap={2} py={1}>
                      <Box w="6px" h="6px" mt="6px" borderRadius="full" bg="#0ea5e9" flexShrink={0} />
                      <Text fontSize="sm" color="text.primary">{asText(f)}</Text>
                    </Flex>
                  ))}
                </Box>
              )}
            </GlassCard>
          </MotionBox>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
