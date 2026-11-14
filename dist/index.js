"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettleTeamsApi = exports.SettleTeams = void 0;
// n8n loads the node and credential from the paths in package.json "n8n"; this entry
// re-exports them for anyone importing the package directly.
var SettleTeams_node_1 = require("./src/nodes/SettleTeams/SettleTeams.node");
Object.defineProperty(exports, "SettleTeams", { enumerable: true, get: function () { return SettleTeams_node_1.SettleTeams; } });
var SettleTeamsApi_credentials_1 = require("./src/credentials/SettleTeamsApi.credentials");
Object.defineProperty(exports, "SettleTeamsApi", { enumerable: true, get: function () { return SettleTeamsApi_credentials_1.SettleTeamsApi; } });
