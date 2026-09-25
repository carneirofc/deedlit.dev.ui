"use client";

import { CodeBlock, CopyButton } from "@carneirofc/ui";

import { Section, cls } from "./primitives";
import type { ClientConfigBlockProps, EndpointRowProps, ToolsListProps } from "./schemas";
import { useMcpAccess } from "./useMcpAccess";

function EndpointRow({ endpoint, copied, onCopy }: EndpointRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-ui-sm text-ui-ink">Endpoint</p>
        <p className="truncate font-mono text-ui-2xs text-ui-ink-muted" title={endpoint}>
          {endpoint}
        </p>
      </div>
      <CopyButton copied={copied} onClick={onCopy} aria-label="Copy MCP endpoint URL" data-testid="mcp-copy-url" />
    </div>
  );
}

function ClientConfigBlock({ endpoint, config, copied, onCopy }: ClientConfigBlockProps) {
  return (
    <div className="py-2.5">
      <div className="mb-2 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-ui-sm text-ui-ink">Client config</p>
          <p className="text-ui-2xs text-ui-ink-muted">
            Add to your MCP client (e.g. Claude Desktop / Claude Code), then restart it.
          </p>
        </div>
        <CopyButton copied={copied} onClick={onCopy} aria-label="Copy MCP client config" data-testid="mcp-copy-config" />
      </div>
      <CodeBlock maxHeight="max-h-48" testId="mcp-config">
        {config}
      </CodeBlock>
      <p className="mt-2 text-ui-2xs text-ui-ink-muted">
        Claude Code CLI:{" "}
        <code className="font-mono text-ui-ink">claude mcp add --transport http comfyhelper {endpoint}</code>
      </p>
    </div>
  );
}

function ToolsList({ tools, toolsState, onLoad }: ToolsListProps) {
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-ui-sm text-ui-ink">Available tools</p>
          <p className="text-ui-2xs text-ui-ink-muted">
            The tool surface the agent can call. Served by the gateway; needs it running.
          </p>
        </div>
        <button
          type="button"
          className={cls.btn}
          onClick={onLoad}
          disabled={toolsState === "loading"}
          data-testid="mcp-load-tools"
        >
          {toolsState === "loading" ? "Loading…" : tools ? "Refresh" : "List tools"}
        </button>
      </div>
      {toolsState === "error" && (
        <p className="mt-2 text-ui-2xs text-error-ink">Couldn’t reach the MCP server — is the deedlit.api gateway up?</p>
      )}
      {tools && tools.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5" data-testid="mcp-tools">
          {tools.map((t) => (
            <li key={t.name} className="text-ui-2xs">
              <code className="font-mono text-accent-cyan">{t.name}</code>
              <span className="text-ui-ink-muted"> — {t.description}</span>
            </li>
          ))}
        </ul>
      )}
      {tools && tools.length === 0 && <p className="mt-2 text-ui-2xs text-ui-ink-muted">No tools advertised.</p>}
    </div>
  );
}

export function McpAccessSection() {
  const { endpoint, tools, toolsState, copied, config, copy, loadTools } = useMcpAccess();

  return (
    <Section
      title="Agent access (MCP)"
      hint="Connect an AI agent (Claude, etc.) to this library over the Model Context Protocol. The app exposes a JSON-RPC MCP server with search, retrieval, graph and ingest tools."
    >
      <EndpointRow endpoint={endpoint} copied={copied === "url"} onCopy={() => copy(endpoint, "url")} />
      <ClientConfigBlock endpoint={endpoint} config={config} copied={copied === "config"} onCopy={() => copy(config, "config")} />
      <ToolsList tools={tools} toolsState={toolsState} onLoad={loadTools} />
    </Section>
  );
}
