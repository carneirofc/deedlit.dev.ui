"use client";

import { forwardRef, type ReactNode } from "react";
import { z } from "zod";

import OutlineButton from "./OutlineButton";
import { cn } from "./utils";

export const FilterSelectionCardPropsSchema = z.object({
  title: z.custom<ReactNode>(),
  items: z.array(z.string()),
  onRemoveItem: z.custom<(item: string) => void>(),
  emptyLabel: z.custom<ReactNode>().optional(),
  testId: z.string().optional(),
  className: z.string().optional(),
  titleClassName: z.string().optional(),
  emptyClassName: z.string().optional(),
  listClassName: z.string().optional(),
  chipClassName: z.string().optional(),
  itemLabelClassName: z.string().optional(),
  removeIconClassName: z.string().optional(),
  removeTitlePrefix: z.string().optional(),
});
export type FilterSelectionCardProps = z.infer<typeof FilterSelectionCardPropsSchema>;

const DEFAULT_CHIP_CLASS =
  "inline-flex max-w-full items-center gap-1 rounded-full border-ui-active bg-[color:var(--ui-bg-active)] px-1.5 py-0 my-0.5 text-ui-2xs text-[color:var(--ui-ink-highlight)]";

export const FilterChipListPropsSchema = z.object({
  items: z.array(z.string()),
  onRemoveItem: z.custom<(item: string) => void>(),
  listClassName: z.string().optional(),
  chipClassName: z.string().optional(),
  itemLabelClassName: z.string().optional(),
  removeIconClassName: z.string().optional(),
  removeTitlePrefix: z.string(),
});
type FilterChipListProps = z.infer<typeof FilterChipListPropsSchema>;

function FilterChipList({
  items,
  onRemoveItem,
  listClassName,
  chipClassName,
  itemLabelClassName,
  removeIconClassName,
  removeTitlePrefix,
}: FilterChipListProps) {
  return (
    <div className={cn("mt-1 flex max-h-14 flex-wrap gap-1 overflow-x-hidden overflow-y-auto", listClassName)}>
      {items.map((item, index) => (
        <OutlineButton
          key={`${item}-${index}`}
          onClick={() => onRemoveItem(item)}
          className={cn(DEFAULT_CHIP_CLASS, chipClassName)}
          title={`${removeTitlePrefix}: ${item}`}
        >
          <span className={cn("max-w-[180px] truncate", itemLabelClassName)}>{item}</span>
          <span aria-hidden className={removeIconClassName}>
            ×
          </span>
        </OutlineButton>
      ))}
    </div>
  );
}

const FilterSelectionCard = forwardRef<HTMLDivElement, FilterSelectionCardProps>(function FilterSelectionCard(
  {
    title,
    items,
    onRemoveItem,
    emptyLabel = "None",
    testId,
    className,
    titleClassName,
    emptyClassName,
    listClassName,
    chipClassName,
    itemLabelClassName,
    removeIconClassName,
    removeTitlePrefix = "Remove",
  },
  ref,
) {
  return (
    <div ref={ref} id={testId} data-testid={testId} className={cn("rounded-lg border border-(--ui-border-soft) bg-panel/75 p-1.5", className)}>
      <p className={cn("text-ui-2xs tracking-[0.1em] text-(--ui-ink-faint)", titleClassName)}>{title}</p>
      {items.length === 0 ? (
        <p className={cn("mt-1 text-ui-2xs tracking-[0.08em] text-ui-ink-subtle", emptyClassName)}>{emptyLabel}</p>
      ) : (
        <FilterChipList
          items={items}
          onRemoveItem={onRemoveItem}
          listClassName={listClassName}
          chipClassName={chipClassName}
          itemLabelClassName={itemLabelClassName}
          removeIconClassName={removeIconClassName}
          removeTitlePrefix={removeTitlePrefix}
        />
      )}
    </div>
  );
});

FilterSelectionCard.displayName = "FilterSelectionCard";

export default FilterSelectionCard;
