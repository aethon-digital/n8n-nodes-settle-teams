// Build step: tsc emits only JavaScript, so the node's icon is copied beside its compiled
// file (n8n resolves `icon: "file:settleTeams.png"` relative to the node's .js file).
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "src", "nodes", "SettleTeams", "settleTeams.png");
const to = join(root, "dist", "src", "nodes", "SettleTeams", "settleTeams.png");
mkdirSync(dirname(to), { recursive: true });
cpSync(from, to);
console.log("copied settleTeams.png");
