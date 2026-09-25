"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";
import { z } from "zod";

import { cn, SPACING_PATTERNS } from "./utils";

export const TextAreaInputSizeSchema = z.enum(["sm", "md"]);
export type TextAreaInputSize = z.infer<typeof TextAreaInputSizeSchema>;

export const TextAreaInputOwnPropsSchema = z.object({
  controlSize: TextAreaInputSizeSchema.optional(),
});
export type TextAreaInputProps = z.infer<typeof TextAreaInputOwnPropsSchema> &
  TextareaHTMLAttributes<HTMLTextAreaElement>;

const BASE_CLASS_NAME = "cyber-input resize-y outline-none";

const SIZE_CLASS_NAMES: Record<TextAreaInputSize, string> = {
  sm: cn("rounded-lg", SPACING_PATTERNS.controlSm, "text-ui-xs"),
  md: cn("rounded-xl", SPACING_PATTERNS.controlMd, "text-ui-sm"),
};

const TextAreaInput = forwardRef<HTMLTextAreaElement, TextAreaInputProps>(function TextAreaInput(
  { className, controlSize = "md", ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(BASE_CLASS_NAME, SIZE_CLASS_NAMES[controlSize], className)} {...props} />;
});

export default TextAreaInput;
