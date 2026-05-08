import React from "react";
import { Box, Flex, VStack, Icon, Text, Link } from "@chakra-ui/react";
import { 
  MdDashboard, 
  MdAnalytics, 
  MdInsights, 
  MdNotificationsActive, 
  MdFactory, 
  MdTransform, 
  MdSchema, 
  MdSettings 
} from "react-icons/md";
import { NavLink as RouterLink, useLocation } from "react-router-dom";

const NavItem = ({ icon, children, to }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      as={RouterLink}
      to={to}
      style={{ textDecoration: 'none', width: '100%' }}
      _focus={{ boxShadow: 'none' }}
    >
      <Flex
        align="center"
        p="3"
        mx="4"
        borderRadius="lg"
        role="group"
        cursor="pointer"
        bg={isActive ? "brand.50" : "transparent"}
        color={isActive ? "brand.600" : "text.secondary"}
        _hover={{
          bg: "brand.50",
          color: "brand.600",
        }}
      >
        {icon && (
          <Icon
            mr="4"
            fontSize="20"
            as={icon}
          />
        )}
        <Text fontWeight="medium" fontSize="sm">{children}</Text>
      </Flex>
    </Link>
  );
};

const Sidebar = () => {
  return (
    <Box
      w="250px"
      bg="bg.surface"
      borderRight="1px"
      borderRightColor="gray.200"
      h="100vh"
      py="6"
      position="fixed"
    >
      <Flex alignItems="center" mx="8" mb="8">
        <Text fontSize="2xl" fontWeight="bold" color="brand.600" letterSpacing="tight">
          THERMYNX
        </Text>
      </Flex>
      <VStack spacing="2" align="stretch">
        <NavItem icon={MdDashboard} to="/">Dashboard</NavItem>
        <NavItem icon={MdAnalytics} to="/analyzer">AI Analyzer</NavItem>
        <NavItem icon={MdInsights} to="/chiller">Chiller Insights</NavItem>
        <NavItem icon={MdNotificationsActive} to="/alarms">Alarm Intelligence</NavItem>
        <NavItem icon={MdFactory} to="/plant">Plant Analytics</NavItem>
        <NavItem icon={MdTransform} to="/etl">ETL Insights</NavItem>
        <NavItem icon={MdSchema} to="/schema">Schema Explorer</NavItem>
        <NavItem icon={MdSettings} to="/settings">Settings</NavItem>
      </VStack>
    </Box>
  );
};

export default Sidebar;
