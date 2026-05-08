import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './pages/Layout';
import AIAnalyzer from './pages/AIAnalyzer';
import { Box, Heading, Text, Center } from '@chakra-ui/react';

const Placeholder = ({ title }) => (
  <Center h="full">
    <Box textAlign="center">
      <Heading color="brand.600" mb="4">{title}</Heading>
      <Text color="text.secondary">This module is under construction.</Text>
    </Box>
  </Center>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Placeholder title="Dashboard" />} />
          <Route path="analyzer" element={<AIAnalyzer />} />
          <Route path="chiller" element={<Placeholder title="Chiller Insights" />} />
          <Route path="alarms" element={<Placeholder title="Alarm Intelligence" />} />
          <Route path="plant" element={<Placeholder title="Plant Analytics" />} />
          <Route path="etl" element={<Placeholder title="ETL Insights" />} />
          <Route path="schema" element={<Placeholder title="Schema Explorer" />} />
          <Route path="settings" element={<Placeholder title="Settings" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
