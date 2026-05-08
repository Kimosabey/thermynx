import { Flex, Box } from "@chakra-ui/react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";

export default function Layout() {
  return (
    <Flex minH="100vh" bg="surface.bg">
      <Sidebar />
      <Box flex={1} overflow="auto" minH="100vh">
        <Outlet />
      </Box>
    </Flex>
  );
}
