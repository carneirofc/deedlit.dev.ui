import { useCallback, useEffect, useMemo, useState } from "react";

import type { McpCopyTarget, McpTool, McpToolsState } from "./schemas";
import { McpToolsResponseSchema } from "./schemas";

/** Resolves the browser-reachable MCP endpoint + a ready-to-paste client config. */
function useMcpEndpoint() {
  // Absolute, browser-reachable endpoint. Resolved on the client so the copied
  // URL/config is something an external MCP client can actually dial.
  const [endpoint, setEndpoint] = useState("/api/mcp");
  const [copied, setCopied] = useState<McpCopyTarget | null>(null);

  useEffect(() => {
    // Sanctioned pattern: render the relative fallback on the server, then swap
    // to the absolute origin once mounted — computing it during render would
    // mismatch the server-rendered HTML.
    if (typeof window !== "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe swap-after-mount, not derivable state
      setEndpoint(`${window.location.origin}/api/mcp`);
    }
  }, []);

  // Ready-to-paste MCP client config (Claude Desktop / Claude Code `mcpServers`
  // block, HTTP transport). Server name mirrors the gateway's serverInfo.
  const config = useMemo(
    () =>
      JSON.stringify(
        { mcpServers: { "comfyhelper-image-library": { type: "http", url: endpoint } } },
        null,
        2,
      ),
    [endpoint],
  );

  const copy = useCallback((text: string, which: McpCopyTarget) => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(which);
        setTimeout(() => setCopied((c) => (c === which ? null : c)), 1500);
      })
      .catch(() => {});
  }, []);

  return { endpoint, config, copied, copy };
}

/** Fetches the MCP tool surface on demand (GET /api/mcp). */
function useMcpToolsList() {
  const [tools, setTools] = useState<McpTool[] | null>(null);
  const [toolsState, setToolsState] = useState<McpToolsState>("idle");

  const loadTools = useCallback(async () => {
    setToolsState("loading");
    try {
      const res = await fetch("/api/mcp");
      if (!res.ok) throw new Error(String(res.status));
      const { tools: parsed } = McpToolsResponseSchema.parse(await res.json());
      setTools(parsed ?? []);
      setToolsState("idle");
    } catch {
      setToolsState("error");
    }
  }, []);

  return { tools, toolsState, loadTools };
}

/**
 * Agent access (MCP) section state — connection details for pointing an AI
 * agent at this library over the Model Context Protocol. This app is
 * UI-only; it proxies a JSON-RPC MCP server (POST /api/mcp -> deedlit.api
 * gateway POST /mcp) that exposes search / retrieval / graph / ingest tools.
 * GET /api/mcp lists them.
 */
export function useMcpAccess() {
  const { endpoint, config, copied, copy } = useMcpEndpoint();
  const { tools, toolsState, loadTools } = useMcpToolsList();

  return { endpoint, tools, toolsState, copied, config, copy, loadTools };
}
