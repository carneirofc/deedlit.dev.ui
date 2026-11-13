import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useState } from "react";
import { fn } from "storybook/test";

import Checkbox from "../Checkbox";
import CollapsiblePanel from "../CollapsiblePanel";
import CopyButton from "../CopyButton";
import { CyberSubpanel } from "../CyberPanels";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "../DropdownMenu";
import FilterSelectionCard from "../FilterSelectionCard";
import type { EffectsIntensity } from "../lib/effects-settings";
import MediaStage from "../MediaStage";
import MetadataTabBar, { type MetadataTabValue } from "../MetadataTabBar";
import OutlineButton from "../OutlineButton";
import Pagination from "../Pagination";
import SectionLabel from "../SectionLabel";
import SegmentedControl from "../SegmentedControl";
import SurfacePanel from "../SurfacePanel";
import { Table, TableBody, TableCell, TableRow } from "../Table";
import { Tabs, TabsList, TabsTrigger } from "../Tabs";

/**
 * Every interactive component's hover, press, focus and disabled states,
 * once per effects intensity. Each column sets `data-ui-intensity` locally
 * (the `--ui-fx-*` tokens inherit), so the three can be compared side by
 * side; the toolbar's Hover fx / Cursor / Motion menus apply to all of them.
 *
 * Hover and press with the pointer, and Tab through to see focus rings.
 */
const meta: Meta = {
  title: "Foundations/Interaction",
  parameters: { layout: "fullscreen" }
};

export default meta;
type Story = StoryObj;

const INTENSITIES: EffectsIntensity[] = ["subtle", "normal", "strong"];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-ui-2xs text-[color:var(--ui-ink-subtle)]">{label}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Showcase({ intensity }: { intensity: EffectsIntensity }) {
  const [segment, setSegment] = useState<"grid" | "list" | "masonry">("grid");
  const [metaTab, setMetaTab] = useState<MetadataTabValue>("details");
  const [page, setPage] = useState(2);
  const [tags, setTags] = useState(["portrait", "night", "neon"]);

  return (
    <section
      data-ui-intensity={intensity}
      aria-label={`${intensity} intensity`}
      className="flex min-w-0 flex-col gap-4 p-4"
    >
      <SectionLabel>{intensity}</SectionLabel>

      <Row label="OutlineButton">
        <OutlineButton variant="neutral">Neutral</OutlineButton>
        <OutlineButton variant="ghost">Ghost</OutlineButton>
        <OutlineButton variant="accent">Accent</OutlineButton>
        <OutlineButton variant="danger">Danger</OutlineButton>
        <OutlineButton disabled={true}>Disabled</OutlineButton>
      </Row>

      <Row label="CopyButton">
        <CopyButton onClick={fn()} />
        <CopyButton copied={true} />
        <CopyButton disabled={true} />
      </Row>

      <Row label="SegmentedControl">
        <SegmentedControl
          value={segment}
          onValueChange={setSegment}
          options={[
            { value: "grid", label: "Grid" },
            { value: "list", label: "List" },
            { value: "masonry", label: "Masonry", disabled: true }
          ]}
        />
      </Row>

      <Row label="Tabs / MetadataTabBar">
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">Overview</TabsTrigger>
            <TabsTrigger value="b">Prompt</TabsTrigger>
            <TabsTrigger value="c" disabled={true}>
              Disabled
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <MetadataTabBar value={metaTab} onValueChange={setMetaTab} className="static" />
      </Row>

      <Row label="Checkbox">
        <Checkbox label="Unchecked" />
        <Checkbox label="Checked" defaultChecked={true} />
        <Checkbox label="Disabled" disabled={true} />
      </Row>

      <Row label="Pagination">
        <Pagination
          className="w-full"
          page={page}
          totalPages={3}
          onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
          onNextPage={() => setPage((p) => Math.min(3, p + 1))}
        />
      </Row>

      <Row label="FilterSelectionCard">
        <FilterSelectionCard
          className="w-full"
          title="Tags"
          items={tags}
          onRemoveItem={(item) => setTags((all) => all.filter((t) => t !== item))}
        />
      </Row>

      <Row label="DropdownMenu">
        <DropdownMenu>
          <DropdownMenuTrigger asChild={true}>
            <OutlineButton>Sort by…</OutlineButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={fn()}>Most recent</DropdownMenuItem>
            <DropdownMenuItem onSelect={fn()}>Name (A–Z)</DropdownMenuItem>
            <DropdownMenuItem disabled={true}>Disabled</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Row>

      <Row label="CollapsiblePanel">
        <SurfacePanel padding="none" className="w-full overflow-hidden">
          <CollapsiblePanel label="Advanced">
            <p className="px-4 pb-3 text-ui-xs">Collapsible content.</p>
          </CollapsiblePanel>
        </SurfacePanel>
      </Row>

      <Row label="Table (interactive rows)">
        <Table>
          <TableBody>
            {["alpha.png", "beta.png"].map((name) => (
              <TableRow key={name} interactive={true} tabIndex={0} onClick={fn()}>
                <TableCell>{name}</TableCell>
                <TableCell>1024×1024</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Row>

      <Row label="MediaStage (hover the edges)">
        <MediaStage canNavigate={true} onNavigate={fn()} className="w-full">
          <div className="grid h-32 place-items-center text-ui-xs">media</div>
        </MediaStage>
      </Row>

      <Row label="Spotlight (SurfacePanel / CyberSubpanel)">
        <SurfacePanel spotlight={true} className="w-full text-ui-xs">
          Move the pointer over this panel.
        </SurfacePanel>
        <CyberSubpanel spotlight={true} className="w-full text-ui-xs">
          Cyber subpanel with spotlight.
        </CyberSubpanel>
      </Row>
    </section>
  );
}

export const Intensities: Story = {
  name: "States × intensity",
  render: () => (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
      {INTENSITIES.map((intensity) => (
        <Showcase key={intensity} intensity={intensity} />
      ))}
    </div>
  )
};
