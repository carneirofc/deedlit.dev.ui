import { z } from "zod";
import type { ReactNode } from "react";
import type { LibrarySettings } from "@/lib/store/settings";

import type { useSettingsBinders } from "./useSettingsBinders";

// ---------------------------------------------------------------------------
// Settings-page primitives
// ---------------------------------------------------------------------------

export const SectionPropsSchema = z.object({
  title: z.string(),
  hint: z.string().optional(),
  children: z.custom<ReactNode>(),
});
export type SectionProps = z.infer<typeof SectionPropsSchema>;

export const RowPropsSchema = z.object({
  label: z.string(),
  hint: z.string().optional(),
  control: z.custom<ReactNode>(),
});
export type RowProps = z.infer<typeof RowPropsSchema>;

export const InfoRowPropsSchema = z.object({
  label: z.string(),
  value: z.string(),
  hint: z.string().optional(),
});
export type InfoRowProps = z.infer<typeof InfoRowPropsSchema>;

export const TogglePropsSchema = z.object({
  checked: z.boolean(),
  onChange: z.custom<(v: boolean) => void>(),
  testId: z.string().optional(),
  ariaLabel: z.string().optional(),
});
export type ToggleProps = z.infer<typeof TogglePropsSchema>;

export const SegmentedOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});
export type SegmentedOption = z.infer<typeof SegmentedOptionSchema>;

// `Segmented` is generic over its option value (T extends string); zod schemas
// can't express generics, so its props use `Record<>` intersections instead of
// object-literal type annotations (banned by no-restricted-syntax).
export type SegmentedProps<T extends string> = Record<"value", T> &
  Record<"options", ReadonlyArray<Record<"value", T> & Record<"label", string>>> &
  Record<"onChange", (v: T) => void> &
  Record<"testIdPrefix", string | undefined>;

export const NumberSliderPropsSchema = z.object({
  value: z.number(),
  min: z.number(),
  max: z.number(),
  step: z.number(),
  format: z.custom<(v: number) => string>().optional(),
  onChange: z.custom<(v: number) => void>(),
  testId: z.string().optional(),
  label: z.string().optional(),
});
export type NumberSliderProps = z.infer<typeof NumberSliderPropsSchema>;

// ---------------------------------------------------------------------------
// Ingest & indexing section
// ---------------------------------------------------------------------------

export const RescanStateSchema = z.enum(["idle", "running", "done", "error"]);
export type RescanState = z.infer<typeof RescanStateSchema>;

export const SaveStateSchema = z.enum(["idle", "saving", "saved", "error"]);
export type SaveState = z.infer<typeof SaveStateSchema>;

export const RescanButtonPropsSchema = z.object({
  rescan: RescanStateSchema,
  onRescan: z.custom<() => void>(),
});
export type RescanButtonProps = z.infer<typeof RescanButtonPropsSchema>;

// ---------------------------------------------------------------------------
// Agent access (MCP) section
// ---------------------------------------------------------------------------

export const McpToolSchema = z.object({
  name: z.string(),
  description: z.string(),
});
export type McpTool = z.infer<typeof McpToolSchema>;

export const McpToolsResponseSchema = z.object({
  tools: z.array(McpToolSchema).optional(),
});
export type McpToolsResponse = z.infer<typeof McpToolsResponseSchema>;

export const McpToolsStateSchema = z.enum(["idle", "loading", "error"]);
export type McpToolsState = z.infer<typeof McpToolsStateSchema>;

export const McpCopyTargetSchema = z.enum(["url", "config"]);
export type McpCopyTarget = z.infer<typeof McpCopyTargetSchema>;

export const EndpointRowPropsSchema = z.object({
  endpoint: z.string(),
  copied: z.boolean(),
  onCopy: z.custom<() => void>(),
});
export type EndpointRowProps = z.infer<typeof EndpointRowPropsSchema>;

export const ClientConfigBlockPropsSchema = z.object({
  endpoint: z.string(),
  config: z.string(),
  copied: z.boolean(),
  onCopy: z.custom<() => void>(),
});
export type ClientConfigBlockProps = z.infer<typeof ClientConfigBlockPropsSchema>;

export const ToolsListPropsSchema = z.object({
  tools: z.array(McpToolSchema).nullable(),
  toolsState: McpToolsStateSchema,
  onLoad: z.custom<() => void>(),
});
export type ToolsListProps = z.infer<typeof ToolsListPropsSchema>;

// ---------------------------------------------------------------------------
// Settings-page sections
// ---------------------------------------------------------------------------

export const SettingsSectionPropsSchema = z.object({
  settings: z.custom<LibrarySettings>(),
  binders: z.custom<ReturnType<typeof useSettingsBinders>>(),
});
export type SettingsSectionProps = z.infer<typeof SettingsSectionPropsSchema>;

export const SafetyChipsPropsSchema = z.object({
  defaultSafety: z.custom<LibrarySettings["defaultSafety"]>(),
  onToggle: z.custom<ReturnType<typeof useSettingsBinders>["toggleDefaultSafety"]>(),
});
export type SafetyChipsProps = z.infer<typeof SafetyChipsPropsSchema>;
