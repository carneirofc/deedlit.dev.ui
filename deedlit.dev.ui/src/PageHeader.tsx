"use client";

import { forwardRef, type ReactNode } from "react";
import { z } from "zod";

import { cn } from "./utils";

export const PageHeaderPropsSchema = z.object({
  /** Subtitle shown above the title (e.g. "deedlit.dev // gallery") */
  subtitle: z.string(),
  /** Main heading */
  title: z.string(),
  /** Heading tag used for title text */
  titleTag: z.enum(["h1", "h2"]).optional(),
  /** Description paragraph below title */
  description: z.string(),
  /** Optional id and data-testid for the header element */
  testId: z.string().optional(),
  /** Optional class name for the root header container */
  className: z.string().optional(),
  /** Optional summary pills rendered on the right */
  pills: z.custom<ReactNode>().optional(),
  /** Optional class name for the pill container */
  pillsClassName: z.string().optional(),
  /** Optional children rendered after the header */
  children: z.custom<ReactNode>().optional(),
});
export type PageHeaderProps = z.infer<typeof PageHeaderPropsSchema>;

const PageHeader = forwardRef<HTMLElement, PageHeaderProps>(function PageHeader(
  { subtitle, title, titleTag = "h1", description, testId, className, pills, pillsClassName, children },
  ref,
) {
  const TitleTag = titleTag;

  return (
    <header
      ref={ref}
      id={testId}
      data-testid={testId}
      className={cn("flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4", className)}
    >
      <div>
        <p className="text-ui-xs uppercase tracking-[0.24em] text-[color:color-mix(in_oklab,var(--accent-cyan)_55%,var(--accent-pink)_45%)]">
          {subtitle}
        </p>
        <TitleTag className="cyber-title mt-2 text-ui-display font-semibold">{title}</TitleTag>
        <p className="cyber-muted mt-2 max-w-3xl text-ui-md">{description}</p>
      </div>
      {pills && (
        <div className={cn("cyber-muted flex flex-wrap items-center gap-2 text-ui-sm", pillsClassName)}>
          {pills}
        </div>
      )}
      {children}
    </header>
  );
});

PageHeader.displayName = "PageHeader";

export default PageHeader;


