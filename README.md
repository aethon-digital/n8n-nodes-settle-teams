# n8n-nodes-settle-teams

An [n8n](https://n8n.io) community node for [Settle for Teams](https://settle.ink/teams): create a group decision from a workflow, send it to the people who decide, and read the result when it settles.

## Operations

All of them are on the **Decision** resource. Each one is a single call to the Settle for Teams API with your workspace's API key.

| Operation | What it does | API |
| --- | --- | --- |
| Create Draft | Creates a draft decision: a question, 2 to 6 options, and optionally a rule, a deadline and stakeholder emails. Nobody is invited until the draft is sent. | `POST /api/v1/decisions/drafts` |
| Send Draft | Sends a draft to its stakeholders and opens voting. Needs a **full-access** key. | `POST /api/v1/decisions/{id}/send` |
| Get Many | Finds decisions by short code or question text: the 20 most recent matches, optionally kept to one status. | `GET /api/v1/decisions?q=` |
| Get | A decision's status, deadline, turnout and per-option counts, by short code or ID. | `GET /api/v1/decisions/{id}/status` |
| Get Results | The same, reduced to the tally, the winner and the decision's link. | `GET /api/v1/decisions/{id}/status` |

Settling is not an operation. A decision settles at its deadline, or a person settles it in the Settle dashboard.

Rules are `majority`, `unanimity` or `creator_decides`. A deadline must be 5 minutes to 30 days ahead; without one, the decision closes 24 hours after it is sent. Turn on **Created by an AI Agent** when an agent proposes the decision: Settle then emails the workspace owner a link to review the draft.

## Install

In n8n, go to **Settings > Community Nodes > Install** and enter `n8n-nodes-settle-teams`. Community nodes need a self-hosted n8n, or n8n Cloud with community nodes allowed.

## Credentials

1. In Settle for Teams, open **Settings > API keys** and create a key. A **draft-only** key can create drafts and read decisions, and is enough unless the workflow also sends drafts. Sending needs a **full-access** key.
2. In n8n, create a **Settle for Teams API** credential and paste the key (it starts with `stlk_`). Keep the base URL as `https://settle.ink`.

The key is sent as `Authorization: Bearer <key>`. n8n checks it against `GET /api/v1/decisions` when you save the credential.

## Example: create a decision from a workflow

1. **Trigger**: for example, a form submission or a new row in a sheet.
2. **Settle for Teams › Create Draft**:
   - Question: `Which vendor do we go with?`
   - Options: `Vendor A`, `Vendor B`
   - Additional fields: Stakeholder Emails `kim@acme.com, lee@acme.com`, Deadline in 2 days.

   The output has the draft's `id` and its `draft_url`. Someone can review it at that link and press Send.
3. Or, with a full-access key, add **Settle for Teams › Send Draft** with Decision ID `{{ $json.id }}` to send it straight away.
4. Later, **Settle for Teams › Get Results** with the decision's short code returns the winner once the decision has settled.

## License

MIT
