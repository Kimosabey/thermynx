import React from "react";
import { Box, Flex } from "@chakra-ui/react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";

const Layout = () => {
  return (
    <Flex h="100vh" bg="bg.main">
      <Sidebar />
      <Box flex="1" ml="250px" p="8" overflowY="auto">
        <Outlet />
      </Box>
    </Flex>
  );
};

export default Layout;
