import { useEffect, useState } from "react";
import {
  Box,
  Flex,
  Grid,
  Heading,
  Text,
  Badge,
  Spinner,
  Alert,
  AlertIcon,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Divider,
  Button,
} from "@chakra-ui/react";

function StatusDot({ ok }) {
  return (
    <Box
      as="span"
      display="inline-block"
      w="8px"
      h="8px"
      borderRadius="full"
      bg={ok ? "green.400" : "red.400"}
      mr={2}
    />
  );
}

function MetricCard({ label, value, unit, helpText, accent = "brand.500" }) {
  return (
    <Box
      bg="white"
      borderRadius="xl"
      p={5}
      border="1px solid"
      borderColor="gray.100"
      boxShadow="0 1px 3px rgba(0,0,0,0.06)"
    >
      <Stat>
        <StatLabel color="gray.500" fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="wider">
          {label}
        </StatLabel>
        <StatNumber fontSize="2xl" fontWeight="700" color={accent} mt={1}>
          {value !== null && value !== undefined ? value : "—"}
          {unit && (
            <Text as="span" fontSize="sm" fontWeight="400" color="gray.500" ml={1}>
              {unit}
            </Text>
          )}
        </StatNumber>
        {helpText && <StatHelpText color="gray.400" mt={1}>{helpText}</StatHelpText>}
      </Stat>
    </Box>
  );
}

function EquipmentPanel({ name, data, type }) {
  const running = data?.running_pct;
  const isOn = running !== null && running > 0;

  return (
    <Box
      bg="white"
      borderRadius="xl"
      p={5}
      border="1px solid"
      borderColor="gray.100"
      boxShadow="0 1px 3px rgba(0,0,0,0.06)"
    >
      <Flex justify="space-between" align="center" mb={3}>
        <Text fontWeight="600" fontSize="sm" color="gray.700">
          {name}
        </Text>
        <Badge
          colorScheme={isOn ? "green" : "gray"}
          variant="subtle"
          borderRadius="full"
          px={2}
          fontSize="10px"
        >
          {isOn ? "ACTIVE" : "STANDBY"}
        </Badge>
      </Flex>
      <Grid templateColumns="1fr 1fr" gap={3}>
        <Box>
          <Text fontSize="10px" color="gray.400" textTransform="uppercase" fontWeight="600">Avg kW</Text>
          <Text fontSize="lg" fontWeight="700" color="gray.800">{data?.avg_kw ?? "—"}</Text>
        </Box>
        <Box>
          <Text fontSize="10px" color="gray.400" textTransform="uppercase" fontWeight="600">Run %</Text>
          <Text fontSize="lg" fontWeight="700" color="gray.800">{running ?? "—"}{running !== null ? "%" : ""}</Text>
        </Box>
        {type === "chiller" && (
          <>
            <Box>
              <Text fontSize="10px" color="gray.400" textTransform="uppercase" fontWeight="600">kW/TR</Text>
              <Text
                fontSize="lg"
                fontWeight="700"
                color={
                  data?.avg_kw_per_tr
                    ? data.avg_kw_per_tr < 0.65
                      ? "green.500"
                      : data.avg_kw_per_tr < 0.85
                      ? "yellow.500"
                      : "red.500"
                    : "gray.800"
                }
              >
                {data?.avg_kw_per_tr ?? "—"}
              </Text>
            </Box>
            <Box>
              <Text fontSize="10px" color="gray.400" textTransform="uppercase" fontWeight="600">Load %</Text>
              <Text fontSize="lg" fontWeight="700" color="gray.800">{data?.avg_chiller_load ?? "—"}{data?.avg_chiller_load ? "%" : ""}</Text>
            </Box>
          </>
        )}
      </Grid>
    </Box>
  );
}

export default function Dashboard() {
  const [health, setHealth] = useState(null);
  const [equipment, setEquipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, equipRes] = await Promise.all([
        fetch("/api/health"),
        fetch("/api/equipment/latest?hours=24"),
      ]);
      const healthData = await healthRes.json();
      const equipData = await equipRes.json();
      setHealth(healthData);
      setEquipment(equipData);
    } catch (e) {
      setError("Failed to connect to backend. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const summary = equipment?.summary || {};

  return (
    <Box p={8} maxW="1400px">
      {/* Header */}
      <Flex justify="space-between" align="center" mb={8}>
        <Box>
          <Heading size="lg" fontWeight="700" color="gray.800">
            Operations Dashboard
          </Heading>
          <Text color="gray.500" mt={1} fontSize="sm">
            Unicharm HVAC Plant — Last 24 hours
          </Text>
        </Box>
        <Button size="sm" variant="outline" onClick={loadData} isLoading={loading}>
          Refresh
        </Button>
      </Flex>

      {/* System Status */}
      {health && (
        <Box
          bg="white"
          borderRadius="xl"
          p={4}
          border="1px solid"
          borderColor="gray.100"
          mb={6}
          boxShadow="0 1px 3px rgba(0,0,0,0.06)"
        >
          <Flex gap={6} align="center" flexWrap="wrap">
            <Text fontSize="xs" fontWeight="700" color="gray.500" textTransform="uppercase" letterSpacing="wider">
              System Status
            </Text>
            <Flex align="center">
              <StatusDot ok={health.database?.connected} />
              <Text fontSize="sm" color="gray.600">Database</Text>
            </Flex>
            <Flex align="center">
              <StatusDot ok={health.ollama?.connected} />
              <Text fontSize="sm" color="gray.600">AI Engine ({health.ollama?.active_model})</Text>
            </Flex>
            <Badge
              colorScheme={health.status === "healthy" ? "green" : "yellow"}
              variant="subtle"
              borderRadius="full"
            >
              {health.status?.toUpperCase()}
            </Badge>
          </Flex>
        </Box>
      )}

      {error && (
        <Alert status="error" borderRadius="xl" mb={6}>
          <AlertIcon />
          {error}
        </Alert>
      )}

      {loading && !equipment ? (
        <Flex justify="center" align="center" h="300px">
          <Spinner size="xl" color="brand.500" thickness="3px" />
        </Flex>
      ) : (
        <>
          {/* KPI Strip */}
          <Grid templateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap={4} mb={6}>
            <MetricCard
              label="Chiller 1 kW/TR"
              value={summary.chiller_1?.avg_kw_per_tr}
              helpText="Efficiency ratio"
              accent={
                summary.chiller_1?.avg_kw_per_tr
                  ? summary.chiller_1.avg_kw_per_tr < 0.65
                    ? "green.500"
                    : summary.chiller_1.avg_kw_per_tr < 0.85
                    ? "yellow.600"
                    : "red.500"
                  : "brand.500"
              }
            />
            <MetricCard
              label="Chiller 2 kW/TR"
              value={summary.chiller_2?.avg_kw_per_tr}
              helpText="Efficiency ratio"
              accent={
                summary.chiller_2?.avg_kw_per_tr
                  ? summary.chiller_2.avg_kw_per_tr < 0.65
                    ? "green.500"
                    : summary.chiller_2.avg_kw_per_tr < 0.85
                    ? "yellow.600"
                    : "red.500"
                  : "brand.500"
              }
            />
            <MetricCard
              label="Chiller 1 Load"
              value={summary.chiller_1?.avg_chiller_load}
              unit="%"
              helpText="Avg cooling load"
            />
            <MetricCard
              label="Chiller 2 Load"
              value={summary.chiller_2?.avg_chiller_load}
              unit="%"
              helpText="Avg cooling load"
            />
            <MetricCard
              label="Ambient Temp"
              value={summary.chiller_1?.latest_ambient_temp}
              unit="°C"
              helpText="Latest reading"
            />
            <MetricCard
              label="CHW Supply Temp"
              value={summary.chiller_1?.latest_evap_leaving_temp}
              unit="°C"
              helpText="Chiller 1 leaving"
            />
          </Grid>

          {/* Equipment Grid */}
          <Heading size="sm" fontWeight="600" color="gray.600" mb={4}>
            Equipment Overview
          </Heading>
          <Grid templateColumns="repeat(auto-fit, minmax(260px, 1fr))" gap={4}>
            <EquipmentPanel name="Chiller 1" data={summary.chiller_1} type="chiller" />
            <EquipmentPanel name="Chiller 2" data={summary.chiller_2} type="chiller" />
            <EquipmentPanel name="Cooling Tower 1" data={summary.cooling_tower_1} type="ct" />
            <EquipmentPanel name="Cooling Tower 2" data={summary.cooling_tower_2} type="ct" />
            <EquipmentPanel name="Condenser Pump 1&2" data={summary.condenser_pump_1} type="pump" />
            <EquipmentPanel name="Condenser Pump 3" data={summary.condenser_pump_3} type="pump" />
          </Grid>
        </>
      )}
    </Box>
  );
}
