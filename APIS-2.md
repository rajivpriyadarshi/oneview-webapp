# Wealth Workflows API

Frontend workflow APIs are exposed through the Wealth CRM chat API.

Base URL: `/api/wealth/crm/`

Authentication: Token-based (`Authorization: Token <token>`).

The current workflow-selection API is available to relationship-manager chats.

---

## Workflow lifecycle

The frontend receives two related objects:

- `execution_plan`: the stable, client-facing list of steps known before a run.
- `workflowRun`: the run result and per-step status overlay returned after execution.

LFX plumbing such as loops, converters, extractors, feedback components, and
output nodes is omitted from the execution plan. Repeated steps include a
`group_id` and `group_label`. Workflow authors control component visibility with
the advanced `include_in_execution_plan` setting; frontend clients do not need
to apply their own component-type filters.

Execution plan schema v2 returns each step's `description` as a list of
sentence-sized display items. Empty descriptions are returned as an empty list.

### GET `/api/wealth/crm/chats/workflow-commands/`

List active workflows available to an RM agent. Pass an optional `agent` query
parameter; otherwise the configured default RM agent is used.

```http
GET /api/wealth/crm/chats/workflow-commands/?agent=oneview-rm
Authorization: Token <token>
```

**Success response (200):**

```json
{
  "agent": "oneview-rm",
  "commands": [
    {
      "command": "/valuator",
      "tool_name": "run_workflow_valuator",
      "name": "Real Estate Value",
      "description": "Refresh real-estate valuations.",
      "input_schema": {
        "type": "object",
        "properties": {
          "client_id": {"type": "integer"}
        },
        "required": ["client_id"],
        "additionalProperties": false
      },
      "execution_plan": {
        "schema_version": 2,
        "flow_hash": "88900a90...",
        "steps": [
          {
            "position": 1,
            "node_id": "ext:zinc_wealth:ZincFindAssets@extra-Ra8Sx",
            "component_type": "ZincFindAssets",
            "label": "Find Assets",
            "description": ["Find the client's real-estate assets."]
          },
          {
            "position": 2,
            "node_id": "ext:zinc_wealth:ZincGetPropertyValueEstimate@extra-qYsoK",
            "component_type": "ZincGetPropertyValueEstimate",
            "label": "Get Property Value Estimate",
            "description": ["Get a current property valuation estimate."],
            "group_id": "LoopComponent-SOskS",
            "group_label": "For each item"
          },
          {
            "position": 3,
            "node_id": "ext:zinc_wealth:ZincUpdateRealEstateMarketValue@extra-5jhrd",
            "component_type": "ZincUpdateRealEstateMarketValue",
            "label": "Update Real Estate Market Value",
            "description": ["Store the refreshed market value."],
            "group_id": "LoopComponent-SOskS",
            "group_label": "For each item"
          }
        ]
      }
    }
  ]
}
```

Use `execution_plan.steps` to show what will happen before submitting the
workflow. Treat `node_id` as an opaque stable identifier and render steps in
`position` order.

An inactive or non-RM agent returns `404`. A user without an active RM profile
returns `403`.

---

## Execute a workflow

### POST `/api/wealth/crm/clients/<client_id>/chats/<session_uid>/messages/`

Select and run a workflow through an existing client-scoped chat:

```json
{
  "message": "Refresh this family's property valuations",
  "metadata": {
    "workflow_intent": {
      "tool_name": "run_workflow_valuator",
      "mode": "run"
    }
  }
}
```

`mode` may be:

| Value     | Behavior                                                   |
|-----------|------------------------------------------------------------|
| `run`     | Resolve required inputs and execute the selected workflow. |
| `suggest` | Prefer the workflow, but allow the agent not to run it.    |

The response is an AI SDK-compatible SSE stream. Workflow lifecycle updates
use events with `type: "data-tool-status"`. A workflow configured with a
structured output contract also emits one `data-artifact` event after its
completed lifecycle event.

### Running event

The running event includes the same execution plan returned by workflow
discovery (abridged below):

```json
{
  "type": "data-tool-status",
  "data": {
    "status": "running",
    "toolCallId": "workflow_abc123",
    "toolName": "run_workflow_valuator",
    "workflow": {
      "id": 13,
      "name": "Real Estate Value",
      "executionPlan": {
        "schema_version": 2,
        "flow_hash": "88900a90...",
        "steps": [
          {
            "position": 1,
            "node_id": "ext:zinc_wealth:ZincFindAssets@extra-Ra8Sx",
            "component_type": "ZincFindAssets",
            "label": "Find Assets",
            "description": ["Find the client's real-estate assets."]
          }
        ]
      }
    }
  }
}
```

At v0, the backend does not stream individual step transitions. Show the plan
with an overall running state until the completed event arrives.

### Completed event

```json
{
  "type": "data-tool-status",
  "data": {
    "status": "completed",
    "toolCallId": "workflow_abc123",
    "toolName": "run_workflow_valuator",
    "workflowRun": {
      "kind": "workflow_run_result",
      "schema_version": 1,
      "run_id": 482,
      "workflow_id": 13,
      "workflow_name": "Real Estate Value",
      "status": "succeeded",
      "execution_plan": {},
      "steps": [
        {
          "node_id": "ext:zinc_wealth:ZincFindAssets@extra-Ra8Sx",
          "label": "Find Assets",
          "status": "succeeded",
          "executions": 1,
          "duration_ms": 184,
          "summary": "Find Assets completed"
        },
        {
          "node_id": "ext:zinc_wealth:ZincGetPropertyValueEstimate@extra-qYsoK",
          "label": "Get Property Value Estimate",
          "status": "succeeded",
          "executions": 3,
          "duration_ms": 921,
          "summary": "Get Property Value Estimate completed 3 times"
        }
      ],
      "result": {},
      "error": ""
    }
  }
}
```

Join `workflowRun.steps` to `execution_plan.steps` by `node_id`. A visible step
status is one of:

| Status      | Meaning                                              |
|-------------|------------------------------------------------------|
| `succeeded` | Every captured execution of the step succeeded.      |
| `failed`    | At least one execution of the step failed.           |
| `running`   | Execution had not finished when the trace was saved. |
| `not_run`   | The planned step was not reached.                    |

The outer `data.status` describes delivery of the tool result. Always inspect
`workflowRun.status` for the actual run outcome; a failed run is delivered with
`data.status: "completed"` and `workflowRun.status: "failed"`.

---

## Structured workflow artifacts

An administrator may configure a chat workflow with an artifact contract such
as `wealth.family_snapshot@1`. The workflow's final output must validate against
that contract. If validation fails, the workflow run is marked failed and no
artifact is emitted.

After a successful configured workflow completes, the stream emits exactly one
additional event:

```json
{
  "type": "data-artifact",
  "data": {
    "id": "54bc...",
    "artifact_type": "wealth.family_snapshot",
    "artifact_version": 1,
    "name": "Meeting Prep",
    "payload": {
      "subject": {},
      "lastMeeting": {},
      "changes": [],
      "followUps": [],
      "discussionPoints": []
    }
  }
}
```

Use the pair `artifact_type` and `artifact_version` to select a renderer. The
client controls whether the result appears inline, in a panel, or in a modal;
the stream does not provide placement or renderer metadata.

The artifact is associated with the final assistant message. A subsequent
`GET /api/wealth/crm/clients/<client_id>/chats/<session_uid>/messages/` returns
the same object as a `data-artifact` message part, so clients should retain the
payload unchanged when restoring chat history. Unsupported artifact types can
be ignored while still rendering the assistant text.

Artifacts are not added as separate LLM context. The workflow tool result
remains the model-visible representation of the workflow output.

---

## Run trace and LLM explanations

The complete trace is stored server-side on the workflow run. It contains LFX
component execution plus exact Zinc tool and primitive inputs, outputs, errors,
and timings. Sensitive credential fields are redacted before persistence.

Raw traces are not exposed as a frontend HTTP contract in v0. The chat agent
has a session-scoped tool:

```text
get_workflow_run_details(run_id, node_id?)
```

- Without `node_id`, it returns a compact list of every captured trace step.
- With `node_id`, it returns the captured input and output for matching step executions.
- A run is accessible only from the chat session that created it.

The workflow result includes `run_id`, so the LLM can inspect the trace when a
user asks questions such as “Why did this fail?” or “How was this value
calculated?”. Frontends should render `workflowRun.steps`; they should not parse
or depend on the internal raw trace format.

---

## Minimal rendering flow

1. Fetch workflow commands and render `execution_plan.steps`.
2. Submit the selected `workflow_intent` with `mode: "run"`.
3. On the running event, show the plan with an overall loading state.
4. On the completed event, overlay `workflowRun.steps` by `node_id`.
5. On a `data-artifact` event, render only the contracts the client supports.
6. Show `workflowRun.error` when `workflowRun.status` is `failed`.

`flow_hash` identifies the published graph used to generate the plan. Replace a
cached plan whenever the hash changes. Admin-only description edits do not
change the graph hash, so use the plan from the latest discovery response.

---

## Internal publishing API

`POST /api/internal/wealth-workflows/workflows/publish/` is an admin/service
endpoint and is not intended for frontend use. Its response includes the newly
generated `execution_plan` for operational verification.

## Editing a published plan

Staff can edit `execution_plan_json` from the Wealth Workflow change page in
Django admin. This is intended for hand-editing client-facing descriptions;
stored description strings are split into the v2 list form when an API response
is built. Publishing or importing the flow again regenerates the execution plan
and replaces manual edits.

The published flow itself remains read-only in admin. Its topology is shown as
a graph, with the complete formatted JSON available in the collapsed fallback
panel.
