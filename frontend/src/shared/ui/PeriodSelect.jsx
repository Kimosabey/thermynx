import { Menu, MenuButton, MenuList, MenuItem, Button, Flex, Text, Box } from "@chakra-ui/react";
import { ChevronDown, Check } from "lucide-react";

/** Shared native-select styling — kept for the few raw <Select> usages elsewhere.
 *  New code should prefer <PeriodSelect/>, which is a custom glass dropdown. */
export const surfaceSelectProps = {
  size: "sm",
  bg: "bg.surface",
  border: "1px solid",
  borderColor: "border.subtle",
  borderRadius: "10px",
  color: "text.primary",
  _hover: { borderColor: "border.strong" },
  _focusVisible: {
    borderColor: "accent.primary",
    boxShadow: "0 0 0 3px rgba(31,63,254,0.12)",
  },
};

export const HOURS_OPTIONS_STANDARD = [
  { value: 6, label: "Last 6 hours" },
  { value: 12, label: "Last 12 hours" },
  { value: 24, label: "Last 24 hours" },
  { value: 48, label: "Last 48 hours" },
  { value: 168, label: "Last 7 days" },
];

export const HOURS_OPTIONS_ANOMALY = [
  { value: 1, label: "Last 1 hour" },
  { value: 3, label: "Last 3 hours" },
  { value: 6, label: "Last 6 hours" },
  { value: 12, label: "Last 12 hours" },
  { value: 24, label: "Last 24 hours" },
];

/**
 * Custom glass dropdown (Chakra Menu) — matches the top-bar menu styling instead
 * of the OS-native <select>. Same API as before: value, onChange, options, width.
 */
export default function PeriodSelect({
  value,
  onChange,
  options = HOURS_OPTIONS_STANDARD,
  width = "150px",
  ...rest
}) {
  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <Menu isLazy placement="bottom-end" gutter={6} {...rest}>
      <MenuButton
        as={Button}
        size="sm"
        w={width}
        justifyContent="space-between"
        fontWeight={600}
        fontSize="13px"
        px="12px"
        bg="bg.surface"
        color="text.primary"
        border="1px solid"
        borderColor="border.subtle"
        borderRadius="10px"
        rightIcon={<ChevronDown size={15} strokeWidth={2} />}
        _hover={{ borderColor: "border.strong", bg: "bg.elevated" }}
        _active={{ bg: "bg.elevated" }}
        _focusVisible={{ borderColor: "accent.primary", boxShadow: "0 0 0 3px rgba(31,63,254,0.12)" }}
      >
        {current?.label ?? "Select"}
      </MenuButton>

      <MenuList
        bg="bg.surface"
        borderColor="border.subtle"
        borderRadius="14px"
        boxShadow="xl"
        py="6px"
        minW={width}
        zIndex={30}
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <MenuItem
              key={o.value}
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
