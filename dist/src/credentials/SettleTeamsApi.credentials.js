"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettleTeamsApi = void 0;
// A Settle for Teams API key (stlk_…), created in Settle under Settings > API keys. Sent as
// `Authorization: Bearer <key>` on every request. A draft-only key can create drafts and
// read decisions; sending a draft needs a full-access key.
class SettleTeamsApi {
    constructor() {
        this.name = "settleTeamsApi";
        this.displayName = "Settle for Teams API";
        this.documentationUrl = "https://settle.ink/teams";
        this.properties = [
            {
                displayName: "API Key",
                name: "apiKey",
                type: "string",
                typeOptions: { password: true },
                default: "",
                required: true,
                placeholder: "stlk_...",
                description: "Create a key in Settle for Teams under Settings > API keys",
            },
            {
                displayName: "Base URL",
                name: "baseUrl",
                type: "string",
                default: "https://settle.ink",
                description: "Leave as is unless Settle gave you another address",
            },
        ];
        this.authenticate = {
            type: "generic",
            properties: {
                headers: {
                    Authorization: "=Bearer {{$credentials.apiKey}}",
                },
            },
        };
        // GET /api/v1/decisions answers 200 with the workspace's recent decisions for any valid
        // key (full or draft-only) and 401 otherwise. It takes no limit parameter.
        this.test = {
            request: {
                baseURL: "={{$credentials.baseUrl}}",
                url: "/api/v1/decisions",
                method: "GET",
            },
        };
    }
}
exports.SettleTeamsApi = SettleTeamsApi;
