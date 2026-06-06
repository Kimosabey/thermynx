import { Menu, MenuButton, MenuList, MenuItem, Button, Flex, Text, Box } from "@chakra-ui/react";
import { ChevronDown, Check } from "lucide-react";

/**
 * Custom glass dropdown — a Chakra Menu styled to match the top-bar menu, used
 * everywhere instead of the OS-native <select>.
 *
 * Props:
 *   value        — current value (string|number; compared loosely)
 *   onChange     — called with the selected option's `value` (NOT an event)
 *   options      — [{ value, label }]
 *   placeholder  — button text when no option matches (default "Select")
 *   width, size  — sizing (default 150px / sm)
 *
 * Note: onChange receives the raw value, so call sites use `onChange={setX}`
 * or `onChange={(v) => setX(v)}` — not `(e) => setX(e.target.value)`.
 */
export default function GlassSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select",
  width = "150px",
  size = "sm",
  ...rest
}) {
  const current = options.find((o) => String(o.value) === String(value));
  const label = current?.label ?? placeholder;

  return (
    <Menu isLazy placement="bottom-start" gutter={6} {...rest}>
      <MenuButton
        as={Button}
        size={size}
        w={width}
        justifyContent="space-between"
        fontWeight={600}
        fontSize="13px"
        px="12px"
        bg="bg.surface"
        color={current ? "text.primary" : "text.muted"}
        border="1px solid"
        borderColor="border.subtle"
        borderRadius="10px"
        rightIcon={<ChevronDown size={15} strokeWidth={2} />}
        _hover={{ borderColor: "border.strong", bg: "bg.elevated" }}
        _active={{ bg: "bg.elevated" }}
        _focusVisible={{ borderColor: "accent.primary", boxShadow: "0 0 0 3px rgba(31,63,254,0.12)" }}
      >
        <Text as="span" noOfLines={1} textAlign="left">{label}</Text>
      </MenuButton>

      <MenuList
        bg="bg.surface"
        borderColor="border.subtle"
        borderRadius="14px"
        boxShadow="xl"
        py="6px"
        minW={width}
        maxH="340px"
        overflowY="auto"
        zIndex={30}
      >
        {options.map((o) => {
          const active = String(o.value) === String(value);
          return (
            <MenuItem
              key={String(o.value)}
              onClick={() => onChange(o.value)}
              mx="6px"
              px="10px"
              py="8px"
              w="auto"
              borderRadius="10px"
              fontSize="13px"
              fontWeight={active ? 700 : 500}
              color={active ? "text.brand" : "text.secondary"}
              bg={active ? "accent.glow" : "transparent"}
              _hover={{ bg: "bg.elevated", color: "text.primary" }}
              _focus={{ bg: "bg.elevated" }}
            >
              <Flex align="center" justify="space-between" gap={3} w="100%">
                <Text as="span">{o.label}</Text>
                {active && (
                  <Box color="accent.primary" flexShrink={0}>
                    <Check size={15} strokeWidth={2.5} />
                  </Box>
                )}
              </Flex>
            </MenuItem>
          );
        })}
      </MenuList>
    </Menu>
  );
}
