// n8n loads the node and credential from the paths in package.json "n8n"; this entry
// re-exports them for anyone importing the package directly.
export { SettleTeams } from "./src/nodes/SettleTeams/SettleTeams.node";
export { SettleTeamsApi } from "./src/credentials/SettleTeamsApi.credentials";
