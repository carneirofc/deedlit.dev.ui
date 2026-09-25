import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ComponentProps } from "react";

import FilterSelectionCard from "./FilterSelectionCard";

const meta = {
  title: "Components/FilterSelectionCard",
  component: FilterSelectionCard,
  tags: ["autodocs"],
  args: {
    title: "ACTIVE TAGS",
    items: ["masterpiece", "cinematic lighting", "depth of field"],
    onRemoveItem: () => {},
  },
} satisfies Meta<typeof FilterSelectionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

function DefaultFilterSelectionCardStory(args: ComponentProps<typeof FilterSelectionCard>) {
  const [items, setItems] = useState(args.items);
  return (
    <div className="w-72">
      <FilterSelectionCard
        {...args}
        items={items}
        onRemoveItem={(item) => setItems((prev) => prev.filter((value) => value !== item))}
      />
    </div>
  );
}

export const Default: Story = {
  render: DefaultFilterSelectionCardStory,
};

export const Empty: Story = {
  args: { items: [] },
  render: (args) => (
    <div className="w-72">
      <FilterSelectionCard {...args} onRemoveItem={() => {}} />
    </div>
  ),
};
