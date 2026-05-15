import { useToast } from "@chakra-ui/react";

/**
 * Standardized toast wrapper with pre-configured durations and positioning.
 *
 * Usage:
 *   const toast = useAppToast();
 *   toast.success("Thread saved", "Conversation memory enabled");
 *   toast.error("Could not connect", "Backend may be offline");
 *   toast.info("Agent complete", `Investigated in ${seconds}s`);
 */
export default function useAppToast() {
  const toast = useToast();

  return {
    success: (title, description) =>
      toast({
        title,
        description,
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "bottom-right",
        variant: "subtle",
      }),
    error: (title, description) =>
      toast({
        title,
        description,
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom-right",
        variant: "subtle",
      }),
    info: (title, description) =>
      toast({
        title,
        description,
        status: "info",
        duration: 3000,
        isClosable: true,
        position: "bottom-right",
        variant: "subtle",
      }),
    warning: (title, description) =>
      toast({
        title,
        description,
        status: "warning",
        duration: 4000,
        isClosable: true,
        position: "bottom-right",
        variant: "subtle",
      }),
  };
}
