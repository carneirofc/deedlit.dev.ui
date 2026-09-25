// Runs ruff + basedpyright in every Python service that has adopted docs/agents/code-style.md.
// Add a service here once it is clean.
import { execSync } from "node:child_process";

const SERVICES = ["deedlit.labelagent"];

for (const service of SERVICES) {
  console.log(`\n== ${service}`);
  execSync("uv run ruff check . && uv run basedpyright", { cwd: service, stdio: "inherit" });
}
