"use client";

import { z } from "zod";

import { Tabs, TabsList, TabsTrigger } from "./Tabs";
import { cn } from "./utils";

export const MetadataTabValueSchema = z.enum(["details", "workflow", "raw"]);
export type MetadataTabValue = z.infer<typeof MetadataTabValueSchema>;

export const MetadataTabBarPropsSchema = z.object({
  value: MetadataTabValueSchema,
  onValueChange: z.custom<(value: MetadataTabValue) => void>(),
  className: z.string().optional(),
  optionClassName: z.string().optional(),
});
export type MetadataTabBarProps = z.infer<typeof MetadataTabBarPropsSchema>;

export const TabOptionSchema = z.object({
  value: MetadataTabValueSchema,
  label: z.string(),
});
export type TabOption = z.infer<typeof TabOptionSchema>;

const TAB_OPTIONS: TabOption[] = [
  { value: "details", label: "Details" },
  { value: "workflow", label: "Workflow" },
  { value: "raw", label: "Raw Metadata" },
];

/**
 * Metadata tab bar built on the accessible {@link Tabs} primitives (roving
 * focus, arrow-key navigation, `role="tablist"`). Renders the tab strip only;
 * pair the controlled `value` with your own panels, or use the `Tabs`/
 * `TabsContent` primitives directly for fully linked `aria-controls` panels.
 */
export default function MetadataTabBar({
  value,
  onValueChange,
  className,
  optionClassName,
}: MetadataTabBarProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onValueChange(next as MetadataTabValue)}
      className={cn("sticky top-0 z-10 w-full backdrop-blur", className)}
    >
      <TabsList className="w-full">
        {TAB_OPTIONS.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            data-testid={`metadata-tab-${option.value}`}
            className={cn("flex-1 py-1.5 text-ui-xs font-semibold", optionClassName)}
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
