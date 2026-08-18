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
