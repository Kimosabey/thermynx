import { useState, useEffect, useMemo } from "react";
import { Box, Flex, Text, Select, Grid, Badge, useColorMode } from "@chakra-ui/react";
import { Network, Wind, Zap, Activity } from "lucide-react";
import { motion } from "framer-motion";
import ReactECharts from "echarts-for-react";
import PageShell from "../../shared/ui/PageShell";
import PageHeader from "../../shared/ui/PageHeader";
import PageHeaderIcon from "../../shared/ui/PageHeaderIcon";
import GlassSelect from "../../shared/ui/GlassSelect";
import GlassCard from "../../shared/ui/GlassCard";
import Eyebrow from "../../shared/ui/Eyebrow";
import { SkeletonKpiCard } from "../../shared/ui/SkeletonCard";

const MotionBox = motion.create(Box);

const BAND_COLOR = {
  good:       "#10b981",
  acceptable: "#f59e0b",
  poor:       "#ef4444",
  unknown:    "#64748b",
};

const TYPE_CATEGORY = {
  chiller:       { idx: 0, label: "Chillers",       color: "#1F3FFE" },
  cooling_tower: { idx: 1, label: "Cooling Towers", color: "#0ea5e9" },
  pump:          { idx: 2, label: "Pumps",          color: "#a78bfa" },
};

export default function TopologyPage() {
  const { colorMode } = useColorMode();
  const isDark = colorMode === "dark";
  const [hours, setHours]     = useState(1);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/topology?hours=${hours}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [hours]);

  const option = useMemo(() => {
    if (!data) return null;
    const categories = Object.values(TYPE_CATEGORY).map(t => ({
      name: t.label,
      itemStyle: { color: t.color },
    }));

    const nodes = data.nodes.map(n => {
      const cat = TYPE_CATEGORY[n.type] || TYPE_CATEGORY.pump;
      const band = BAND_COLOR[n.band] || BAND_COLOR.unknown;
      return {
        id:           n.id,
        name:         n.name,
        category:     cat.idx,
        symbolSize:   n.running ? 56 : 44,
        itemStyle: {
          color:        n.running ? cat.color : (isDark ? "#3B3B42" : "#CCCCCF"),
          borderColor:  band,
          borderWidth:  3,
          shadowBlur:   n.running ? 14 : 0,
          shadowColor:  cat.color + "66",
        },
        label: {
          show:      true,
          color:     isDark ? "#F1F1F4" : "#1D1D21",
          fontSize:  10,
          fontWeight: 600,
          position:  "bottom",
          distance:  6,
        },
        value: n.kw,
        _band:    n.band,
        _running: n.running,
        _kw:      n.kw,
        _kw_per_tr: n.kw_per_tr,
      };
    });

    const edges = data.edges.map(e => ({
      source: e.source,
      target: e.target,
      lineStyle: {
        color:    isDark ? "rgba(255,255,255,0.18)" : "rgba(31,63,254,0.45)",
        width:    1.6,
        curveness: 0.18,
        opacity:  0.85,
      },
      label: { show: false },
    }));

    return {
      animation: true,
      animationDuration: 600,
      tooltip: {
        backgroundColor: isDark ? "#0d1526" : "#ffffff",
        borderColor:     isDark ? "#1e2d4a" : "#E0E7FF",
        borderRadius: 10,
        padding: [8, 12],
        textStyle: { fontSize: 11, color: isDark ? "#fff" : "#0D0D0D" },
        formatter(params) {
          if (params.dataType === "edge") {
            return `<div>${params.data.source} → ${params.data.target}</div>`;
          }
          const d = params.data;
          return `
            <div style="font-weight:700;margin-bottom:4px">${d.name}</div>
            <div style="font-size:10px;color:${isDark?'#aaa':'#666'}">${d._running ? "Running" : "Stopped"}</div>
            ${d._kw != null ? `<div>kW: <b>${Number(d._kw).toFixed(1)}</b></div>` : ""}
            ${d._kw_per_tr != null ? `<div>kW/TR: <b>${Number(d._kw_per_tr).toFixed(3)}</b></div>` : ""}
            ${d._band !== "unknown" ? `<div>Band: <b style="color:${BAND_COLOR[d._band]}">${d._band}</b></div>` : ""}
          `;
        },
      },
      legend: [{
        data: categories.map(c => c.name),
        top: 8,
        textStyle: { color: isDark ? "#CCCCD4" : "#3B3B42", fontSize: 11 },
        itemWidth: 12, itemHeight: 8,
      }],
      series: [{
        type: "graph",
        layout: "force",
        force: {
          repulsion: 280,
          edgeLength: 130,
          gravity: 0.08,
        },
        roam: true,
        draggable: true,
        symbol: "circle",
        categories,
        edgeSymbol: ["none", "arrow"],
        edgeSymbolSize: [0, 7],
        data:  nodes,
        links: edges,
        emphasis: {
          focus: "adjacency",
          lineStyle: { width: 3, opacity: 1 },
        },
      }],
    };
  }, [data, isDark]);

  const running = data?.nodes?.filter(n => n.running).length ?? 0;
  const total   = data?.nodes?.length ?? 0;

  return (
    <PageShell>
      <PageHeader
        title="Asset Topology"
        icon={<PageHeaderIcon icon={<Network size={20} strokeWidth={1.85} />} />}
        subtitle="Interactive plant graph — drag nodes, zoom, hover for live state"
        actions={
          <GlassSelect value={hours} onChange={(v) => setHours(Number(v))} width="140px"
            options={[
              { value: 1, label: "Latest 1h" },
              { value: 6, label: "Latest 6h" },
              { value: 24, label: "Latest 24h" },
            ]} />
        }
      />

      {/* Summary chips */}
      {data && !loading && (
        <Grid templateColumns={{ base: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))", lg: "repeat(4,minmax(0,1fr))" }} gap={4} mb={6}>
          {[
            { l: "Total assets", v: total, c: "text.primary", Icon: Network },
            { l: "Running",      v: `${running}/${total}`, c: "#10b981", Icon: Activity },
            { l: "Chillers",     v: data.nodes.filter(n => n.type === "chiller").length, c: TYPE_CATEGORY.chiller.color, Icon: Wind },
            { l: "Pumps + Towers", v: data.nodes.filter(n => n.type !== "chiller").length, c: TYPE_CATEGORY.cooling_tower.color, Icon: Zap },
          ].map((s, i) => (
            <MotionBox key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: i * 0.04 }}>
              <GlassCard p={4}>
                <Flex align="center" gap={2} mb={2}>
                  <Box color={s.c}><s.Icon size={14} strokeWidth={2} /></Box>
                  <Eyebrow>{s.l}</Eyebrow>
                </Flex>
                <Text fontSize="2xl" fontWeight={700} color={s.c} sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {s.v}
                </Text>
              </GlassCard>
            </MotionBox>
          ))}
        </Grid>
      )}

      {loading
        ? <SkeletonKpiCard />
        : option && (
          <GlassCard p={0} overflow="hidden">
            <Flex px={5} pt={4} pb={3} align="center" gap={3} flexWrap="wrap">
              <Text fontWeight={700} fontSize="sm" color="text.primary">Plant topology graph</Text>
              <Flex gap={2} ml="auto">
                {Object.entries(BAND_COLOR).filter(([k]) => k !== "unknown").map(([k, c]) => (
                  <Flex key={k} align="center" gap={1}>
                    <Box w="8px" h="8px" borderRadius="full" border="2px solid" borderColor={c} />
                    <Text fontSize="10px" color="text.muted" textTransform="capitalize">{k}</Text>
                  </Flex>
                ))}
              </Flex>
            </Flex>
            <ReactECharts
              option={option}
              style={{ height: "560px", width: "100%" }}
              opts={{ renderer: "canvas" }}
            />
            <Box px={5} pb={3}>
              <Text fontSize="10px" color="text.muted">
                Drag to pan · scroll to zoom · drag a node to reposition · hover for live readings
              </Text>
            </Box>
          </GlassCard>
        )
      }
    </PageShell>
  );
}
