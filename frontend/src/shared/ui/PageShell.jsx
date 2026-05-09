import { Box } from "@chakra-ui/react";

/** Consistent outer padding + max width for every route (fluid below max width). */
export default function PageShell({ children, maxW = "1400px", ...props }) {
  return (
    <Box
      p={{ base: 3, sm: 4, md: 6, xl: 8 }}
      maxW={maxW}
      maxWidth="100%"
      mx="auto"
      w="100%"
      minW={0}
      {...props}
    >
      {children}
    </Box>
  );
}
