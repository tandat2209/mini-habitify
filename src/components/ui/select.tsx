"use client";

import { useContext, type ComponentProps } from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AppearanceColorContext,
  AppearanceThemeContext,
} from "@/components/appearance/appearance-scope";

type SelectOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};
type SelectProps<T extends string> = Omit<
  ComponentProps<typeof SelectPrimitive.Trigger>,
  "value" | "onChange" | "children" | "defaultValue" | "dir"
> & {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SelectOption<T>[];
  name?: string;
};

// Encoding every value keeps empty choices selectable without reserving a user value.
const encodeValue = (value: string) => `option:${value}`;

export function Select<T extends string>({
  value,
  onValueChange,
  options,
  disabled,
  name,
  className,
  ...props
}: SelectProps<T>) {
  const theme = useContext(AppearanceThemeContext);
  const colors = useContext(AppearanceColorContext);
  return (
    <SelectPrimitive.Root
      value={encodeValue(value)}
      onValueChange={(encoded) => {
        const option = options.find(
          (entry) => encodeValue(entry.value) === encoded,
        );
        if (option) onValueChange(option.value);
      }}
      disabled={disabled}
      name={name}
    >
      <SelectPrimitive.Trigger
        {...props}
        data-slot="select-trigger"
        className={cn("select-trigger", className)}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon asChild>
          <ChevronDown aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          data-slot="select-content"
          data-theme={theme}
          data-custom-primary={colors["--primary"] ? true : undefined}
          style={colors}
          className="select-content"
          position="popper"
          sideOffset={6}
          collisionPadding={12}
        >
          <SelectPrimitive.ScrollUpButton className="select-scroll-button">
            <ChevronUp aria-hidden />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="select-viewport">
            <SelectPrimitive.Group>
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={encodeValue(option.value)}
                  data-value={option.value}
                  disabled={option.disabled}
                  className="select-item"
                  textValue={option.label}
                >
                  <SelectPrimitive.ItemText>
                    {option.label}
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="select-indicator">
                    <Check aria-hidden />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Group>
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="select-scroll-button">
            <ChevronDown aria-hidden />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
