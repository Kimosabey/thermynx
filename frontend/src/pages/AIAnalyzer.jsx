import { useState, useRef } from "react";
import {
  Box,
  Flex,
  Heading,
  Text,
  Textarea,
  Button,
  VStack,
  HStack,
  Badge,
  Spinner,
  Alert,
  AlertIcon,
  Select,
  Divider,
  Grid,
  useToast,
} from "@chakra-ui/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const QUICK_PROMPTS = [
  "Analyze the current chiller efficiency and identify any performance issues.",
  "Compare Chiller 1 vs Chiller 2 performance for the last 24 hours.",
  "What is the current kW/TR efficiency? Is it within optimal range?",
  "Are there any anomalies or alerts in the HVAC system right now?",
  "Provide a maintenance recommendation based on the current data.",
  "Summarize total energy consumption and cooling output for today.",
];

function MarkdownRenderer({ content }) {
  return (
    <Box
      className="md-content"
      sx={{
        "h2, h3": { fontWeight: 700, mt: 4, mb: 2, color: "gray.800" },
        h2: { fontSize: "lg", borderBottom: "1px solid", borderColor: "gray.100", pb: 1 },
        h3: { fontSize: "md", color: "brand.700" },
        p: { mb: 3, lineHeight: 1.75, color: "gray.700" },
        "ul, ol": { pl: 5, mb: 3 },
        li: { mb: 1, color: "gray.700" },
        "li > p": { mb: 1 },
        strong: { color: "gray.900", fontWeight: 600 },
        code: {
          bg: "gray.50",
          px: "4px",
          py: "1px",
          borderRadius: "4px",
          fontSize: "0.85em",
          fontFamily: "mono",
          color: "brand.700",
        },
        pre: {
          bg: "gray.900",
          color: "green.300",
          p: 4,
          borderRadius: "lg",
          overflowX: "auto",
          mb: 3,
          fontSize: "sm",
        },
        blockquote: {
          borderLeft: "3px solid",
          borderColor: "brand.300",
          pl: 4,
          ml: 0,
          color: "gray.500",
          fontStyle: "italic",
        },
        table: { width: "100%", borderCollapse: "collapse", mb: 3 },
        "th, td": { border: "1px solid", borderColor: "gray.200", px: 3, py: 2, textAlign: "left" },
        th: { bg: "gray.50", fontWeight: 600, fontSize: "sm" },
        td: { fontSize: "sm" },
        hr: { borderColor: "gray.200", my: 4 },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </Box>
  );
}

export default function AIAnalyzer() {
  const [question, setQuestion] = useState("");
  const [hours, setHours] = useState(24);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();
  const responseRef = useRef(null);

  async function handleAnalyze() {
    if (!question.trim()) {
      toast({ title: "Please enter a question.", status: "warning", duration: 2000, isClosable: true });
      return;
    }
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), hours }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setResponse(data);

      setTimeout(() => {
        responseRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleAnalyze();
    }
  }

  return (
    <Box p={8} maxW="1100px">
      {/* Header */}
      <Flex align="center" gap={3} mb={2}>
        <Box
          w={10}
          h={10}
          borderRadius="xl"
          bg="brand.500"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18 2.5 2.5 0 0 0 10 15.5 2.5 2.5 0 0 0 7.5 13m9 0A2.5 2.5 0 0 0 14 15.5a2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 16.5 13z" />
          </svg>
        </Box>
        <Box>
          <Heading size="lg" fontWeight="700" color="gray.800">
            AI Analyzer
          </Heading>
          <Text color="gray.500" fontSize="sm">
            Ask anything about your HVAC plant — powered by local AI
          </Text>
        </Box>
      </Flex>

      <Divider my={5} />

      {/* Quick Prompts */}
      <Box mb={5}>
        <Text fontSize="xs" fontWeight="700" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={3}>
          Quick Analysis
        </Text>
        <Flex flexWrap="wrap" gap={2}>
          {QUICK_PROMPTS.map((p, i) => (
            <Button
              key={i}
              size="sm"
              variant="outline"
              borderRadius="full"
              colorScheme="gray"
              fontWeight="400"
              fontSize="xs"
              color="gray.600"
              _hover={{ bg: "brand.50", borderColor: "brand.300", color: "brand.700" }}
              onClick={() => setQuestion(p)}
              maxW="360px"
              whiteSpace="normal"
              textAlign="left"
              h="auto"
              py={2}
              px={3}
            >
              {p}
            </Button>
          ))}
        </Flex>
      </Box>

      {/* Input */}
      <Box
        bg="white"
        borderRadius="xl"
        border="1px solid"
        borderColor="gray.200"
        p={4}
        boxShadow="0 1px 3px rgba(0,0,0,0.06)"
        mb={4}
      >
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about chiller efficiency, energy consumption, maintenance needs, anomalies..."
          rows={4}
          resize="vertical"
          border="none"
          _focus={{ outline: "none", boxShadow: "none" }}
          fontSize="sm"
          color="gray.800"
          p={0}
        />
        <Flex justify="space-between" align="center" mt={3} pt={3} borderTop="1px solid" borderColor="gray.100">
          <HStack spacing={3}>
            <Text fontSize="xs" color="gray.400">Data window:</Text>
            <Select
              size="xs"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              w="120px"
              borderRadius="lg"
            >
              <option value={6}>Last 6 hours</option>
              <option value={12}>Last 12 hours</option>
              <option value={24}>Last 24 hours</option>
              <option value={48}>Last 48 hours</option>
              <option value={168}>Last 7 days</option>
            </Select>
          </HStack>
          <HStack spacing={2}>
            <Text fontSize="xs" color="gray.400">Ctrl+Enter to submit</Text>
            <Button
              size="sm"
              colorScheme="brand"
              onClick={handleAnalyze}
              isLoading={loading}
              loadingText="Analyzing..."
              borderRadius="lg"
              px={5}
            >
              Analyze
            </Button>
          </HStack>
        </Flex>
      </Box>

      {/* Error */}
      {error && (
        <Alert status="error" borderRadius="xl" mb={4}>
          <AlertIcon />
          {error}
        </Alert>
      )}

      {/* Loading skeleton */}
      {loading && (
        <Box
          bg="white"
          borderRadius="xl"
          p={8}
          border="1px solid"
          borderColor="gray.100"
          boxShadow="0 1px 3px rgba(0,0,0,0.06)"
        >
          <Flex align="center" gap={3} mb={4}>
            <Spinner size="sm" color="brand.500" />
            <Text fontSize="sm" color="gray.500">
              Fetching live HVAC data and generating analysis...
            </Text>
          </Flex>
          {[80, 65, 90, 55].map((w, i) => (
            <Box key={i} h="12px" bg="gray.100" borderRadius="full" w={`${w}%`} mb={3} />
          ))}
        </Box>
      )}

      {/* Response */}
      {response && !loading && (
        <Box
          ref={responseRef}
          bg="white"
          borderRadius="xl"
          border="1px solid"
          borderColor="gray.100"
          boxShadow="0 1px 3px rgba(0,0,0,0.06)"
          overflow="hidden"
        >
          {/* Response Header */}
          <Flex
            px={6}
            py={4}
            bg="gray.50"
            borderBottom="1px solid"
            borderColor="gray.100"
            align="center"
            justify="space-between"
            flexWrap="wrap"
            gap={2}
          >
            <Flex align="center" gap={2}>
              <Box w={2} h={2} borderRadius="full" bg="green.400" />
              <Text fontSize="sm" fontWeight="600" color="gray.700">
                AI Analysis Complete
              </Text>
            </Flex>
            <HStack spacing={2}>
              <Badge colorScheme="blue" variant="subtle" borderRadius="full" fontSize="10px">
                {response.model_used}
              </Badge>
              <Badge colorScheme="gray" variant="subtle" borderRadius="full" fontSize="10px">
                {response.data_window_hours}h window
              </Badge>
            </HStack>
          </Flex>

          {/* Efficiency Mini-Cards */}
          {response.summary && (
            <Grid templateColumns="repeat(auto-fit, minmax(140px, 1fr))" gap={0} borderBottom="1px solid" borderColor="gray.100">
              {[
                { label: "CH1 kW/TR", value: response.summary.chiller_1?.avg_kw_per_tr },
                { label: "CH2 kW/TR", value: response.summary.chiller_2?.avg_kw_per_tr },
                { label: "CH1 Load", value: response.summary.chiller_1?.avg_chiller_load, suffix: "%" },
                { label: "CH2 Load", value: response.summary.chiller_2?.avg_chiller_load, suffix: "%" },
              ].map((item, i) => (
                <Box
                  key={i}
                  px={4}
                  py={3}
                  borderRight={i < 3 ? "1px solid" : "none"}
                  borderColor="gray.100"
                >
                  <Text fontSize="10px" color="gray.400" textTransform="uppercase" fontWeight="600" letterSpacing="wider">
                    {item.label}
                  </Text>
                  <Text
                    fontSize="xl"
                    fontWeight="700"
                    color={
                      item.value && item.label.includes("kW/TR")
                        ? item.value < 0.65
                          ? "green.500"
                          : item.value < 0.85
                          ? "yellow.600"
                          : "red.500"
                        : "gray.800"
                    }
                  >
                    {item.value ?? "—"}{item.suffix || ""}
                  </Text>
                </Box>
              ))}
            </Grid>
          )}

          {/* Markdown content */}
          <Box px={6} py={6}>
            <MarkdownRenderer content={response.answer} />
          </Box>
        </Box>
      )}
    </Box>
  );
}
