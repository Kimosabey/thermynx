import React, { useState } from "react";
import { 
  Box, Heading, Text, VStack, HStack, Select, Textarea, 
  Button, Spinner, Flex
} from "@chakra-ui/react";
import { MdSend } from "react-icons/md";
import axios from "axios";

const AIAnalyzer = () => {
  const [table, setTable] = useState("chiller_1_normalized");
  const [rowLimit, setRowLimit] = useState(5);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const promptTemplates = [
    "Analyze the condenser approach temperature and identify any inefficiencies.",
    "Summarize the recent alarms and identify potential root causes.",
    "Evaluate the overall plant efficiency (kW/Ton) and suggest optimizations.",
    "Check for any anomalous behavior in the chiller operation."
  ];

  const handleAnalyze = async () => {
    if (!question.trim()) {
      setErrorMsg("Please enter an HVAC question to analyze.");
      return;
    }

    setLoading(true);
    setResult(null);
    setErrorMsg("");

    try {
      const response = await axios.post("http://localhost:8000/api/analyze", {
        question: question,
        table_name: table,
        row_limit: Number(rowLimit),
      });
      
      setResult(response.data);
    } catch (error) {
      setErrorMsg(error.response?.data?.detail || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box maxW="1200px" mx="auto">
      <VStack align="stretch" spacing="6">
        <Box>
          <Heading size="lg" color="brand.800" mb="2">AI Operations Analyzer</Heading>
          <Text color="text.secondary">Ask operational questions about your HVAC and Chiller Plant data using local AI.</Text>
        </Box>

        <Box bg="bg.surface" p="6" borderRadius="xl" boxShadow="sm">
          <VStack align="stretch" spacing="5">
            <HStack spacing="4">
              <Box flex="1">
                <Text mb="2" fontWeight="medium" fontSize="sm" color="text.secondary">Target Table</Text>
                <Select value={table} onChange={(e) => setTable(e.target.value)} size="md" borderRadius="md">
                  <option value="chiller_1_normalized">Chiller 1 (Normalized)</option>
                  <option value="plant_normalized">Plant Output (Normalized)</option>
                  <option value="gl_alarm">System Alarms (gl_alarm)</option>
                </Select>
              </Box>
              <Box flex="1">
                <Text mb="2" fontWeight="medium" fontSize="sm" color="text.secondary">Data Sample Limit</Text>
                <Select value={rowLimit} onChange={(e) => setRowLimit(e.target.value)} size="md" borderRadius="md">
                  <option value="5">5 Rows</option>
                  <option value="10">10 Rows</option>
                  <option value="20">20 Rows</option>
                </Select>
              </Box>
            </HStack>

            <Box>
              <Flex justify="space-between" align="center" mb="2">
                <Text fontWeight="medium" fontSize="sm" color="text.secondary">Your Query</Text>
                <Select 
                  placeholder="Load a Template..." 
                  size="xs" 
                  w="auto" 
                  borderRadius="md"
                  onChange={(e) => {
                    if(e.target.value) setQuestion(e.target.value);
                  }}
                >
                  {promptTemplates.map((template, index) => (
                    <option key={index} value={template}>
                      Template {index + 1}: {template.substring(0, 30)}...
                    </option>
                  ))}
                </Select>
              </Flex>
              <Textarea 
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. Analyze the condenser approach temperature and identify any inefficiencies..."
                rows={4}
                borderRadius="md"
                focusBorderColor="brand.500"
              />
            </Box>

            {errorMsg && (
              <Box p="3" bg="red.50" color="red.600" borderRadius="md" border="1px" borderColor="red.200">
                <Text fontSize="sm" fontWeight="medium">{errorMsg}</Text>
              </Box>
            )}

            <Flex justify="flex-end">
              <Button 
                onClick={handleAnalyze} 
                isLoading={loading} 
                loadingText="Analyzing..." 
                rightIcon={<MdSend />}
                size="lg"
                px="8"
              >
                Run Analysis
              </Button>
            </Flex>
          </VStack>
        </Box>

        {loading && (
          <Flex justify="center" align="center" p="12" direction="column">
            <Spinner size="xl" color="brand.500" thickness="4px" speed="0.65s" />
            <Text mt="4" color="brand.600" fontWeight="medium">THERMYNX AI is analyzing data...</Text>
          </Flex>
        )}

        {result && (
          <Box bg="bg.surface" p="8" borderRadius="xl" boxShadow="sm" borderTop="4px solid" borderColor="brand.500">
            <HStack justify="space-between" mb="4">
              <Heading size="md" color="text.primary">Analysis Report</Heading>
              <Text fontSize="sm" color="text.secondary">Analyzed {result.rows_fetched} rows from {result.table_used}</Text>
            </HStack>
            <Box borderBottomWidth="1px" borderColor="gray.200" mb="6" w="100%" />
            <Box 
              className="markdown-body" 
              fontSize="md" 
              lineHeight="tall" 
              color="gray.700"
              sx={{
                "p": { mb: "4" },
                "h1, h2, h3": { color: "brand.800", fontWeight: "bold", mb: "3", mt: "6" },
                "ul, ol": { pl: "6", mb: "4" },
                "li": { mb: "1" },
                "strong": { color: "gray.900" }
              }}
            >
              {/* Note: In a real app, use react-markdown here */}
              <div dangerouslySetInnerHTML={{ __html: result.analysis.replace(/\n/g, '<br />') }} />
            </Box>
          </Box>
        )}
      </VStack>
    </Box>
  );
};

export default AIAnalyzer;
