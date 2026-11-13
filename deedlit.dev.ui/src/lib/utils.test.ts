import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cn } from "./utils.ts";

describe("cn", () => {
  it("keeps a text-ui-* size next to a text colour", () => {
    assert.equal(
      cn("text-ui-xs rounded-md", "text-ui-2xs", "text-[color:var(--ui-ink)]"),
      "rounded-md text-ui-2xs text-[color:var(--ui-ink)]"
    );
  });

  it("lets a later text-ui-* size replace an earlier one", () => {
    assert.equal(cn("text-ui-xs", "text-ui-sm"), "text-ui-sm");
    assert.equal(cn("text-sm", "text-ui-display"), "text-ui-display");
  });
});
