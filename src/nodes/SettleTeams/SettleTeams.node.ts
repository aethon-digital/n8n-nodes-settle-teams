import type { IDataObject, IExecuteFunctions, IHttpRequestOptions, INodeExecutionData, INodeType, INodeTypeDescription } from "n8n-workflow";

// Settle for Teams in n8n: create a decision draft, send it, find decisions and read their
// status and results. Every operation is one call to an existing Settle for Teams API
// endpoint with the workspace's API key (credential settleTeamsApi); the node adds no
// behaviour of its own beyond shaping parameters and filtering a search's results.
//
//   Create Draft  POST /api/v1/decisions/drafts   (multipart: a `payload` JSON field)
//   Send Draft    POST /api/v1/decisions/{id}/send  needs a full-access key
//   Get Many      GET  /api/v1/decisions?q=       the 20 most recent matches
//   Get           GET  /api/v1/decisions/{id}/status
//   Get Results   GET  /api/v1/decisions/{id}/status, reduced to the tally and winner
//
// Settling a decision is not offered: Settle has no API-key endpoint for it (a decision
// settles at its deadline, or from the dashboard).

const RULES = [
  { name: "Majority", value: "majority", description: "An option needs a Yes from more than half of the invited stakeholders" },
  { name: "Unanimity", value: "unanimity", description: "Every invited stakeholder must approve the same option" },
  { name: "Creator Decides", value: "creator_decides", description: "Stakeholders advise; the decision's creator makes the call" },
];

const STATUSES = [
  { name: "All", value: "all" },
  { name: "Draft", value: "draft" },
  { name: "Open", value: "open" },
  { name: "Settled", value: "settled" },
  { name: "Escalated", value: "escalated" },
];

const emails = (raw: unknown): string[] =>
  String(raw ?? "")
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

export class SettleTeams implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Settle for Teams",
    name: "settleTeams",
    icon: "file:settleTeams.png",
    group: ["transform"],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: "Create and manage group decisions with Settle for Teams",
    defaults: { name: "Settle for Teams", color: "#1FA444" },
    inputs: ["main"],
    outputs: ["main"],
    credentials: [{ name: "settleTeamsApi", required: true }],
    usableAsTool: true,
    codex: { categories: ["Productivity"] },
    properties: [
      {
        displayName: "Resource",
        name: "resource",
        type: "options",
        noDataExpression: true,
        options: [{ name: "Decision", value: "decision" }],
        default: "decision",
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["decision"] } },
        options: [
          { name: "Create Draft", value: "createDraft", description: "Create a draft decision for someone to review and send", action: "Create a draft decision" },
          { name: "Send Draft", value: "send", description: "Send a draft to its stakeholders (needs a full-access key)", action: "Send a draft decision" },
          { name: "Get Many", value: "getAll", description: "Find decisions by short code or question text", action: "Get many decisions" },
          { name: "Get", value: "get", description: "Get a decision's status by short code or ID", action: "Get a decision" },
          { name: "Get Results", value: "getResults", description: "Get a decision's tally and winner", action: "Get a decision's results" },
        ],
        default: "createDraft",
      },

      // ---- Create Draft ----
      {
        displayName: "Question",
        name: "question",
        type: "string",
        required: true,
        default: "",
        placeholder: "Which vendor do we go with?",
        description: "What the group decides, 1 to 140 characters",
        displayOptions: { show: { operation: ["createDraft"] } },
      },
      {
        displayName: "Options",
        name: "options",
        type: "string",
        typeOptions: { multipleValues: true, multipleValueButtonText: "Add Option" },
        required: true,
        default: [],
        description: "2 to 6 options, each 1 to 200 characters",
        displayOptions: { show: { operation: ["createDraft"] } },
      },
      {
        displayName: "Additional Fields",
        name: "additionalFields",
        type: "collection",
        placeholder: "Add Field",
        default: {},
        displayOptions: { show: { operation: ["createDraft"] } },
        options: [
          { displayName: "Rule", name: "rule", type: "options", options: RULES, default: "majority", description: "How the decision settles" },
          {
            displayName: "Deadline",
            name: "deadline",
            type: "dateTime",
            default: "",
            description: "When voting closes: 5 minutes to 30 days ahead. Without one, the decision closes 24 hours after it is sent.",
          },
          {
            displayName: "Stakeholder Emails",
            name: "stakeholders",
            type: "string",
            default: "",
            placeholder: "kim@acme.com, lee@acme.com",
            description: "Who will vote, separated by commas (at most 30). Nobody is invited until the draft is sent.",
          },
          {
            displayName: "Created by an AI Agent",
            name: "agent",
            type: "boolean",
            default: false,
            description: "Whether an AI agent proposed this decision. Settle then emails the workspace owner a link to review the draft.",
          },
          {
            displayName: "Source Metadata",
            name: "sourceMetadata",
            type: "json",
            default: "{}",
            description: "A JSON object stored with the decision (at most 4 KB), e.g. the ID of the record that triggered the workflow",
          },
        ],
      },

      // ---- Send Draft / Get / Get Results ----
      {
        displayName: "Decision ID",
        name: "decisionId",
        type: "string",
        required: true,
        default: "",
        description: "The draft's ID, as Create Draft returns it",
        displayOptions: { show: { operation: ["send"] } },
      },
      {
        displayName: "Additional Fields",
        name: "sendFields",
        type: "collection",
        placeholder: "Add Field",
        default: {},
        displayOptions: { show: { operation: ["send"] } },
        options: [
          {
            displayName: "Stakeholder Emails",
            name: "participants",
            type: "string",
            default: "",
            description: "More stakeholders to invite, separated by commas. Those already on the draft are invited too.",
          },
        ],
      },
      {
        displayName: "Decision",
        name: "decisionRef",
        type: "string",
        required: true,
        default: "",
        placeholder: "ABC123",
        description: "The decision's short code (as in its link) or its ID",
        displayOptions: { show: { operation: ["get", "getResults"] } },
      },

      // ---- Get Many ----
      {
        displayName: "Search",
        name: "search",
        type: "string",
        default: "",
        description: "Match a short code or words in the question. Leave empty for the most recent decisions.",
        displayOptions: { show: { operation: ["getAll"] } },
      },
      {
        displayName: "Status",
        name: "status",
        type: "options",
        options: STATUSES,
        default: "all",
        description: "Keep only decisions with this status, out of the 20 most recent matches Settle returns",
        displayOptions: { show: { operation: ["getAll"] } },
      },
      {
        displayName: "Limit",
        name: "limit",
        type: "number",
        typeOptions: { minValue: 1, maxValue: 20 },
        default: 20,
        description: "Max number of results to return",
        displayOptions: { show: { operation: ["getAll"] } },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const out: INodeExecutionData[] = [];
    const credentials = await this.getCredentials("settleTeamsApi");
    const baseURL = String(credentials.baseUrl || "https://settle.ink").replace(/\/+$/, "");
    const call = (options: IHttpRequestOptions) => this.helpers.httpRequestWithAuthentication.call(this, "settleTeamsApi", { baseURL, json: true, ...options });

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter("operation", i) as string;

        if (operation === "createDraft") {
          const question = String(this.getNodeParameter("question", i)).trim();
          const labels = (this.getNodeParameter("options", i, []) as unknown[]).map((o) => String(o).trim()).filter(Boolean);
          if (labels.length < 2 || labels.length > 6) throw new Error(`A decision needs 2 to 6 options; ${labels.length} given.`);
          const extra = this.getNodeParameter("additionalFields", i, {}) as IDataObject;
          const payload: IDataObject = {
            question,
            options: labels.map((label) => ({ label, kind: "text" })),
            source: "api",
            source_metadata: parseMetadata(extra.sourceMetadata),
          };
          if (extra.rule) payload.rule = extra.rule;
          if (extra.deadline) payload.deadline = new Date(String(extra.deadline)).toISOString();
          const stakeholders = emails(extra.stakeholders);
          if (stakeholders.length) payload.stakeholders = stakeholders;
          if (extra.agent === true) {
            payload.origin = "agent";
            payload.client = "n8n";
          }
          const form = new FormData();
          form.set("payload", JSON.stringify(payload));
          out.push({ json: (await call({ method: "POST", url: "/api/v1/decisions/drafts", body: form, json: false })) as IDataObject, pairedItem: { item: i } });
        } else if (operation === "send") {
          const id = String(this.getNodeParameter("decisionId", i)).trim();
          const extra = this.getNodeParameter("sendFields", i, {}) as IDataObject;
          const participants = emails(extra.participants).map((email) => ({ email }));
          const res = await call({ method: "POST", url: `/api/v1/decisions/${encodeURIComponent(id)}/send`, body: participants.length ? { participants } : {} });
          out.push({ json: res as IDataObject, pairedItem: { item: i } });
        } else if (operation === "getAll") {
          const search = String(this.getNodeParameter("search", i, "")).trim();
          const status = String(this.getNodeParameter("status", i, "all"));
          const limit = Number(this.getNodeParameter("limit", i, 20));
          const res = (await call({ method: "GET", url: "/api/v1/decisions", ...(search ? { qs: { q: search } } : {}) })) as { decisions?: IDataObject[] };
          const found = (res.decisions ?? []).filter((d) => status === "all" || d.status === status).slice(0, limit);
          for (const d of found) out.push({ json: d, pairedItem: { item: i } });
        } else if (operation === "get" || operation === "getResults") {
          const ref = String(this.getNodeParameter("decisionRef", i)).trim();
          const res = (await call({ method: "GET", url: `/api/v1/decisions/${encodeURIComponent(ref)}/status` })) as IDataObject;
          out.push({ json: operation === "get" ? res : results(res), pairedItem: { item: i } });
        } else {
          throw new Error(`Unknown operation: ${operation}`);
        }
      } catch (err) {
        if (this.continueOnFail()) {
          out.push({ json: { error: errorMessage(err) }, pairedItem: { item: i } });
          continue;
        }
        throw err;
      }
    }
    return [out];
  }
}

/** The status body reduced to what a results step needs. */
function results(s: IDataObject): IDataObject {
  return {
    short_code: s.short_code,
    status: s.status,
    winner: s.winner ?? null,
    total_voters: s.total_voters,
    invited: s.invited,
    options: s.options,
    decision_url: s.decision_url,
  };
}

function parseMetadata(raw: unknown): IDataObject {
  if (raw === undefined || raw === null || raw === "") return {};
  const value = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Source Metadata must be a JSON object.");
  return value as IDataObject;
}

function errorMessage(err: unknown): string {
  const e = err as { message?: string; response?: { body?: { message?: string; error?: string } }; description?: string };
  return e?.response?.body?.message ?? e?.description ?? e?.message ?? String(err);
}
