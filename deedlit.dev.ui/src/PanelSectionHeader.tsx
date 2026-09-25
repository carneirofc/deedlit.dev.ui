"use client";

import { forwardRef, type ReactNode } from "react";
import { z } from "zod";

import { cn } from "./utils";

export const PanelSectionHeaderPropsSchema = z.object({
  title: z.custom<ReactNode>(),
  description: z.custom<ReactNode>().optional(),
  actions: z.custom<ReactNode>().optional(),
  className: z.string().optional(),
  titleClassName: z.string().optional(),
  descriptionClassName: z.string().optional(),
  actionsClassName: z.string().optional(),
});
export type PanelSectionHeaderProps = z.infer<typeof PanelSectionHeaderPropsSchema>;

const PanelSectionHeader = forwardRef<HTMLDivElement, PanelSectionHeaderProps>(
  function PanelSectionHeader(
    { title, description, actions, className, titleClassName, descriptionClassName, actionsClassName },
    ref,
  ) {
    return (
      <div ref={ref} className={cn("flex flex-wrap items-center justify-between gap-2", className)}>
        <div>
          <p
            className={cn(
              "ui-text-label-sm text-(--ui-ink-accent)",
              titleClassName,
            )}
          >
            {title}
          </p>
          {description && (
            <p className={cn("mt-1 text-ui-xs text-[color:var(--ui-ink-subtle)]", descriptionClassName)}>
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className={cn("flex flex-wrap items-center gap-2", actionsClassName)}>{actions}</div>
        )}
      </div>
    );
  },
);

export default PanelSectionHeader;


