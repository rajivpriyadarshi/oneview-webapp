# Wealth CRM API

Base URL: `/api/wealth/crm/`

Authentication: Token-based (`Authorization: Token <token>`) unless noted otherwise.

---

## Auth

### POST `/api/wealth/crm/login/`

Authenticate a relationship manager and receive an auth token.

**Permission:** Public (no auth required)

**Request body (JSON):**

| Field    | Type   | Required | Description                    |
|----------|--------|----------|--------------------------------|
| email    | string | yes      | RM's email address or username |
| password | string | yes      | Password                       |

**Success response (200):**

```json
{
  "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b",
  "advisor": {
    "id": 1,
    "name": "Arjun Mehta",
    "email": "arjun.mehta@zinclabs.dev",
    "designation": "Senior Relationship Manager",
    "team": "Ultra HNW - Singapore"
  }
}
```

**Error responses:**

| Status | Body                                                                      |
|--------|---------------------------------------------------------------------------|
| 400    | `{"error": "Email and password are required."}`                           |
| 401    | `{"error": "Invalid email or password."}`                                 |
| 403    | `{"error": "This account is not linked to a Relationship Manager profile."}` |

---

### POST `/api/wealth/crm/logout/`

Delete the current auth token.

**Headers:** `Authorization: Token <token>`

**Success response (200):**

```json
{"message": "Logged out."}
```

---

## Clients

### GET `/api/wealth/crm/clients/`

List clients assigned to the authenticated relationship manager.

**Headers:** `Authorization: Token <token>`

**Query parameters:**

| Param     | Type   | Description                                      |
|-----------|--------|--------------------------------------------------|
| search    | string | Filter by display_name or legal_name (icontains) |
| is_active | string | Filter by active status (`true` or `false`)      |
| page      | int    | Page number (default: 1)                         |

**Success response (200):**

```json
{
  "count": 42,
  "next": "/api/wealth/crm/clients/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "display_name": "Rajesh Kumar",
      "legal_name": "Rajesh Kumar Sharma",
      "party_type": "person",
      "base_currency": "INR",
      "primary_tax_jurisdiction": "IN",
      "is_active": true,
      "last_interaction_at": "2026-08-10T14:30:00Z",
      "upcoming_meeting_at": "2026-08-25T10:00:00Z",
      "net_worth": "12610000.00",
      "net_worth_currency": "INR",
      "created_at": "2025-01-15T09:00:00Z",
      "updated_at": "2026-08-10T14:30:00Z"
    }
  ]
}
```

**Error responses:**

| Status | Body                                                                      |
|--------|---------------------------------------------------------------------------|
| 403    | `{"error": "This account is not linked to a Relationship Manager profile."}` |

---

## RM Client Chat

All chat endpoints require an active RM token and a client currently assigned to
that RM. The URL client is fixed for the session: wealth tools can access that
client family, but not an unrelated family.

### GET/POST `/api/wealth/crm/clients/<client_id>/chats/`

- `GET`: list the RM's chats for this client. Use `?archived_only=true` for archived chats.
- `POST`: start a chat and stream the first reply. Send a user message in the
  same format as the OneView chat API; `agent` is optional and must name an RM agent.

```json
{"message": "Summarise this family's portfolio", "agent": "oneview-rm"}
```

### GET/POST `/api/wealth/crm/clients/<client_id>/chats/<session_uid>/messages/`

- `GET`: return chat history.
- `POST`: stream a reply for an existing chat. The SSE format matches OneView chat.

### PATCH `/api/wealth/crm/clients/<client_id>/chats/<session_uid>/pin/`

### PATCH `/api/wealth/crm/clients/<client_id>/chats/<session_uid>/archive/`

Set the corresponding boolean (`is_pinned` or `is_archived`) in the JSON body,
or omit it to toggle the current value.

Another RM's client, a mismatched client/session pair, or an inactive assignment
returns `404`.

---

## RM Chat Workflows

### GET `/api/wealth/crm/chats/workflow-commands/`

List the active chat workflows available to an RM agent. This endpoint requires
an active RM token but is not scoped to a client.

Pass an optional `agent` query parameter to select an active RM agent:

```http
GET /api/wealth/crm/chats/workflow-commands/?agent=oneview-rm
```

When `agent` is omitted, the configured default RM agent is used. The response
includes the resolved agent slug and its commands:

```json
{
  "agent": "oneview-rm",
  "commands": [
    {
      "command": "/meeting-prep",
      "tool_name": "run_workflow_meeting_prep",
      "name": "Meeting prep",
      "description": "Prepare for an upcoming client meeting.",
      "input_schema": {}
    }
  ]
}
```

An inactive or non-RM agent returns `404`. A user without an active RM profile
returns `403`.

### POST `/api/wealth/crm/clients/<client_id>/chats/<session_uid>/messages/`

Select a workflow for one or more chat turns by including an intent in message
metadata:

```json
{
  "message": "Prepare me for tomorrow's meeting",
  "metadata": {
    "workflow_intent": {
      "tool_name": "run_workflow_meeting_prep",
      "mode": "run"
    }
  }
}
```

Use `suggest` to make the workflow preferred but optional, or `run` to resolve
its inputs and execute it as soon as the arguments validate. Omit the intent to
return the chat to normal behavior.

---

## Client Memory

### GET `/api/wealth/crm/memories/`

List client memories. Filter with `?client_id=<id>`.

### GET/PUT/PATCH `/api/wealth/crm/memories/<id>/`

Retrieve or update a client memory.

---

## Interactions

### GET `/api/wealth/crm/interactions/`

List interactions. Filter with `?client_id=<id>`.

### POST `/api/wealth/crm/interactions/`

Create a new interaction. Automatically applies memory extraction.

**Request body (JSON):**

| Field                    | Type     | Required | Description                                                    |
|--------------------------|----------|----------|----------------------------------------------------------------|
| client                   | integer  | yes      | Client ID                                                      |
| occurred_at              | datetime | yes      | When the interaction occurred (ISO 8601)                       |
| source_type              | string   | yes      | One of: `email`, `voice_note`, `text_note`, `meeting_note`, `call_summary`, `document` |
| direction                | string   | no       | One of: `client_to_advisor`, `advisor_to_client`, `meeting`, `internal`, `other` |
| subject                  | string   | no       | Short subject line                                             |
| body                     | string   | yes      | Interaction content                                            |
| meeting_duration_minutes | integer  | no       | Duration in minutes (for meetings)                             |
| attendees                | array    | no       | List of attendee names                                         |
| action_items             | array    | no       | List of action item strings                                    |

### GET/PUT/DELETE `/api/wealth/crm/interactions/<id>/`

Retrieve, update, or delete a specific interaction.

---

## Timeline

### GET `/api/wealth/crm/timeline/`

List activity events (read-only). Filter with `?client_id=<id>`, `?event_type=<type>`, `?search=<text>`.

---

## Meeting Prep Notes

### GET `/api/wealth/crm/prep-notes/`

List meeting prep notes. Filter with `?client_id=<id>`.

### POST `/api/wealth/crm/prep-notes/generate/`

Generate a new meeting prep note using LLM.

**Request body (JSON):**

| Field           | Type     | Required | Description                    |
|-----------------|----------|----------|--------------------------------|
| client_id       | integer  | yes      | Client ID                      |
| meeting_at      | datetime | yes      | Meeting date/time (ISO 8601)   |
| meeting_purpose | string   | no       | Purpose of the meeting         |
| lookback_days   | integer  | no       | Days of history to consider (default: 90) |

---

## Client Graph

### GET `/api/wealth/clients/<id>/graph/`

Returns a hierarchical 4-section breakdown of a client's wealth universe, designed for rendering as a radial mind-map / tree visualization.

**Headers:** `Authorization: Token <token>`

**Query parameters:**

| Param    | Type   | Description                                          |
|----------|--------|------------------------------------------------------|
| currency | string | Target currency for all values (default: client's base_currency) |

**Success response (200):**

```json
{
  "client": {
    "id": 271,
    "name": "Sarah Chen",
    "partyType": "person",
    "adjustedValue": 13784150.0,
    "currency": "USD"
  },
  "sections": {
    "financials": {
      "adjustedValue": 1274014.0,
      "items": [
        {
          "id": "asset-487",
          "type": "asset",
          "name": "JPMorgan Chase (United States)",
          "assetType": "BANK",
          "adjustedValue": 340000.0,
          "currency": "USD",
          "status": "valued"
        },
        {
          "id": "account-186",
          "type": "account",
          "name": "Fidelity (United States)",
          "institution": "fidelity",
          "adjustedValue": 1436000.0,
          "currency": "USD",
          "status": "valued"
        },
        {
          "id": "liability-106",
          "type": "liability",
          "name": "Wells Fargo Mortgage (Palo Alto)",
          "liabilityType": "mortgage",
          "adjustedValue": -2800000.0,
          "linkedAssetId": null,
          "status": "valued"
        }
      ]
    },
    "family": {
      "members": [
        {
          "id": 272,
          "name": "David Chen",
          "partyType": "person",
          "relationship": "spouse",
          "adjustedValue": 0.0
        }
      ]
    },
    "nonFinancials": {
      "adjustedValue": 12510136.0,
      "items": [
        {
          "id": "asset-490",
          "type": "asset",
          "name": "742 Hillsborough Ave, Palo Alto, CA",
          "assetType": "REAL_ESTATE",
          "adjustedValue": 7200000.0,
          "currency": "USD",
          "status": "valued"
        }
      ]
    },
    "entities": {
      "adjustedValue": 0.0,
      "items": [
        {
          "id": 275,
          "type": "client",
          "name": "Chen Family Trust",
          "partyType": "trust",
          "relationship": "settlor",
          "ownershipPct": null,
          "adjustedValue": 0.0,
          "attributedValue": 0.0,
          "sharedWith": []
        }
      ]
    }
  }
}
```

**Section mapping:**

| Section        | Contents                                                                 |
|----------------|--------------------------------------------------------------------------|
| financials     | Bank accounts, fixed income, private investments, brokerage accounts, liabilities |
| family         | Related clients with family relationship types (spouse, parent, child, sibling) |
| nonFinancials  | Real estate, collectibles, digital assets, generic assets, insurance     |
| entities       | Trusts, companies, partnerships, foundations, estates (leaf nodes — navigate to their own graph) |

**Item types within sections:**

| type      | Fields                                                                                  |
|-----------|-----------------------------------------------------------------------------------------|
| asset     | `id`, `type`, `name`, `assetType`, `adjustedValue`, `currency`, `status`               |
| account   | `id`, `type`, `name`, `institution`, `adjustedValue`, `currency`, `status`             |
| liability | `id`, `type`, `name`, `liabilityType`, `adjustedValue` (negative), `linkedAssetId`, `status` |
| client    | `id`, `type`, `name`, `partyType`, `relationship`, `ownershipPct`, `adjustedValue`, `attributedValue`, `sharedWith` |

**Status values:**

| Status         | Meaning                              |
|----------------|--------------------------------------|
| valued         | Has a valuation within the last 30 days |
| stale          | Has a valuation older than 30 days   |
| not_on_record  | No valuation exists                  |

**Shared entity handling (trusts owned by multiple clients):**

When an entity (e.g. a trust) is related to multiple clients, the response includes:
- `adjustedValue`: full value of the entity
- `ownershipPct`: viewer's ownership percentage (from `ClientRelationship.percentage`, null if not set)
- `attributedValue`: viewer's share (`adjustedValue * ownershipPct / 100`, or full value if pct is null)
- `sharedWith`: array of co-owners with their `clientId`, `name`, `relationship`, and `pct`

Navigating to an entity's own graph (`/api/wealth/clients/<entity_id>/graph/`) returns its assets broken down in the same 4-section structure.

---

## Alerts

### GET `/api/wealth/crm/alerts/`

List unread alerts for the authenticated relationship manager (read-only). Only returns alerts where `mark_read` is `false`.

**Headers:** `Authorization: Token <token>`

**Query parameters:**

| Param | Type | Description          |
|-------|------|----------------------|
| page  | int  | Page number (default: 1) |

**Success response (200):**

```json
{
  "count": 3,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "relationship_manager": 1,
      "client": 42,
      "client_name": "Rajesh Kumar",
      "title": "Portfolio rebalancing needed",
      "cta_url": "https://app.zinclabs.dev/wealth/clients/42/rebalance",
      "cta_text": "Review now",
      "mark_read": false,
      "created_at": "2026-08-19T09:00:00Z"
    },
    {
      "id": 2,
      "relationship_manager": 1,
      "client": null,
      "client_name": null,
      "title": "Portfolio review app added",
      "cta_url": "https://app.zinclabs.dev/wealth/portfolio-review",
      "cta_text": "Check now",
      "mark_read": false,
      "created_at": "2026-08-19T08:00:00Z"
    }
  ]
}
```

### GET `/api/wealth/crm/alerts/<id>/`

Retrieve a single alert.

### POST `/api/wealth/crm/alerts/<id>/read/`

Mark an alert as read. Once marked, it no longer appears in the list endpoint.

**Headers:** `Authorization: Token <token>`

**Success response (200):**

```json
{"status": "ok"}
```

---

## Meetings

### GET `/api/wealth/crm/meetings/`

List meetings for the authenticated relationship manager (read-only).

**Headers:** `Authorization: Token <token>`

**Query parameters:**

| Param    | Type   | Description                              |
|----------|--------|------------------------------------------|
| upcoming | string | `true` to show only future meetings      |
| page     | int    | Page number (default: 1)                 |

**Success response (200):**

```json
{
  "count": 5,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "relationship_manager": 1,
      "client": 42,
      "client_name": "Rajesh Kumar",
      "title": "Quarterly portfolio review",
      "scheduled_at": "2026-08-25T10:00:00Z",
      "duration_minutes": 60,
      "created_at": "2026-08-18T14:00:00Z"
    }
  ]
}
```

### GET `/api/wealth/crm/meetings/<id>/`

Retrieve a single meeting.

---

## Dropbox Analysis

### POST `/api/wealth/crm/my-clients/<client_id>/analyze-dropbox/` *(UI endpoint)*

> Note: This is a session-authenticated UI endpoint at `/wealth/crm/my-clients/<id>/analyze-dropbox/`.
> It accepts multipart form data and returns JSON.

Analyze a dropped file (audio/text/PDF) and/or notes, returning prefilled interaction fields.

**Request (multipart/form-data):**

| Field | Type   | Required          | Description                          |
|-------|--------|-------------------|--------------------------------------|
| file  | file   | one of file/notes | Audio (.mp3, .m4a, .wav), text (.txt), or PDF |
| notes | string | one of file/notes | Free-form advisor notes              |

**Success response (200):**

```json
{
  "source_type": "meeting_note",
  "direction": "meeting",
  "subject": "Q3 Portfolio Review",
  "body": "Cleaned and structured content...",
  "meeting_duration_minutes": 45,
  "attendees": ["John Smith", "Jane Advisor"],
  "action_items": ["Rebalance equity allocation", "Send tax docs"],
  "occurred_at": "2026-08-14T10:00:00"
}
```