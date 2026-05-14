import { Box } from "@chakra-ui/react";

/**
 * 40×40 gradient icon tile used in PageHeader to visually anchor each page.
 * White Lucide icon (size 20, stroke 1.85) on a brand-gradient square.
 *
 * Usage:
 *   <PageHeader
 *     title="AI Agents"
 *     icon={<PageHeaderIcon icon={<Bot size={20} strokeWidth={1.85} />} />}
 *   />
 *
 *   // Custom gradient (e.g. for agent mode color):
 *   <PageHeaderIcon
 *     icon={<ScanSearch size={20} strokeWidth={1.85} />}
 *     gradient="linear-gradient(135deg, #1F3FFE, #000F64)"
 *   />
 */
export default function PageHeaderIcon({
  icon,
  gradient = "linear-gradient(135deg, #1F3FFE, #000F64)",
}) {
  return (
    <Box
      w="40px"
      h="40px"
      borderRadius="12px"
      bgGradient={undefined}
      background={gradient}
      display="flex"
      alignItems="center"
      justifyContent="center"
      color="white"
      flexShrink={0}
      boxShadow="0 4px 20px rgba(31,63,254,0.30)"
    >
      {icon}
    </Box>
  );
}
