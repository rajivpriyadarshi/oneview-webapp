# New APIs

## Broker Statement Upload

**`POST /api/wealth/oneview/broker-statements/upload/`**

Upload and parse a broker statement file. Supports CSV, XLSX, and PDF formats from multiple brokers.

### Authentication

```
Authorization: Token <token>
```

### Request (multipart/form-data)

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `file` | File | Yes | — | Broker statement file (`.csv`, `.xlsx`, or `.pdf`). Max 5MB. |
| `password` | String | No | `""` | Password for encrypted PDF statements (e.g. PAN number for Zerodha). |
| `name` | String | No | filename | Document name for storage. |
| `description` | String | No | `""` | Optional description. |
| `store_data` | Boolean | No | `true` | Whether to store parsed holdings in the database. |
| `portfolio_name` | String | No | `"Main Portfolio"` | Portfolio name to store holdings under (created if not exists). Ignored if `portfolio_id` is provided. |
| `portfolio_id` | Integer | No | `null` | Target an existing portfolio by ID. Takes precedence over `portfolio_name`. Validated for ownership. |
| `use_llm_fallback` | Boolean | No | `true` | Use Gemini LLM as fallback parser if no broker-specific parser matches. |

### Supported Brokers

| Broker | Formats | Notes |
|---|---|---|
| Zerodha | XLSX, PDF | PDF monthly statements are password-protected (password = PAN number) |
| Groww | XLSX | — |
| IBKR | PDF, CSV | — |
| Vested | XLSX | — |
| Fidelity | CSV, XLSX | — |
| Kotak | XLSX | — |
| CAS (CAMS/KFintech) | PDF | Consolidated Account Statement |
| Generic | CSV | Fallback for unrecognized CSV formats |

### Success Response (`200 OK`)

```json
{
  "status": "success",
  "document_id": 28,
  "broker": "zerodha",
  "statement_date": "2026-04-30",
  "client_code": "04004881",
  "account_name": "BFH120",
  "positions_count": 24,
  "transactions_count": 4,
  "total_invested": null,
  "total_current": "489382.000",
  "currency": "INR",
  "positions": [
    {
      "asset_type": "equity",
      "isin": "INE769A01020",
      "symbol": "",
      "name": "AARTI IND-EQ RS.5",
      "quantity": "100.000",
      "avg_price": null,
      "cost_basis": null,
      "price": "507.200",
      "value": "50720.000",
      "currency": "INR"
    }
  ],
  "storage": {
    "portfolio": "Main Portfolio",
    "portfolio_id": 7,
    "account": "Zerodha - BFH120",
    "account_id": 3,
    "positions_created": 24,
    "positions_updated": 0,
    "listings_created": 12,
    "stored_positions": [
      { "portfolio_listing_id": 42, "ticker": "AARTI", "name": "AARTI IND-EQ RS.5", "action": "created" },
      { "portfolio_listing_id": 43, "ticker": "HDFC", "name": "HDFC Bank Ltd", "action": "updated" }
    ]
  }
}
```

> `positions` array is limited to 50 entries. If truncated, `positions_truncated: true` and `total_positions` are included.
> `storage` is only present when `store_data=true` and storage succeeds.
> `storage.stored_positions` lists each position with its action (`created` or `updated`) — useful for showing users exactly what changed.
> `storage.portfolio_id` enables immediate frontend navigation to the target portfolio.

### Error Responses (`400 Bad Request`)

#### Password required (encrypted PDF, no password provided)

```json
{
  "status": "error",
  "error": "This PDF is password-protected. Please provide the password.",
  "error_code": "password_required",
  "document_id": 26
}
```

#### Password incorrect

```json
{
  "status": "error",
  "error": "The provided password is incorrect.",
  "error_code": "password_incorrect",
  "document_id": 27
}
```

#### Document limit reached

```json
{
  "detail": "Document limit reached. You can upload a maximum of 10 documents."
}
```

#### Parse failed (unrecognized format)

```json
{
  "status": "error",
  "error": "Could not detect broker from PDF. Supported: IBKR, CAS, Zerodha.",
  "warnings": ["..."],
  "document_id": 29
}
```

#### Invalid file

```json
{
  "file": ["Unsupported file format. Allowed: .csv, .xlsx, .pdf"]
}
```

### Error Codes

| `error_code` | Meaning |
|---|---|
| `password_required` | PDF is encrypted and no `password` field was provided |
| `password_incorrect` | PDF is encrypted and the supplied `password` is wrong |

### Example

```bash
curl -X POST https://<host>/api/wealth/oneview/broker-statements/upload/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -F "file=@zerodha-statement.pdf" \
  -F "password=ABCDE1234F" \
  -F "portfolio_name=Main Portfolio" \
  -F "store_data=true"
```

---

## Documents

**`GET /api/wealth/oneview/documents/`** — list user's documents
**`GET /api/wealth/oneview/documents/{id}/`** — retrieve a document
**`POST /api/wealth/oneview/documents/`** — upload a document (multipart/form-data)
**`PATCH /api/wealth/oneview/documents/{id}/`** — update name/description
**`DELETE /api/wealth/oneview/documents/{id}/`** — delete a document
**`GET /api/wealth/oneview/documents/{id}/positions/`** — list extracted positions

### Authentication

```
Authorization: Token <token>
```

### List Response (`200 OK`)

```json
{
  "count": 3,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 28,
      "name": "zerodha_jun2026_portfolio.pdf",
      "display_name": "Zerodha - 2026-06-01 Statement",
      "description": "",
      "file": "http://host/media/wealth_documents/user_1/zerodha_jun2026_portfolio.pdf",
      "file_url": "http://host/media/wealth_documents/user_1/zerodha_jun2026_portfolio.pdf",
      "file_size": 82656,
      "content_type": "application/pdf",
      "broker": "zerodha",
      "document_type": "investments",
      "processing_status": "processed",
      "uploaded_by": 1,
      "uploaded_by_username": "yash@z.inc",
      "accounts": [
        {
          "id": 3,
          "name": "Zerodha - BFH120",
          "institution_name": "zerodha",
          "account_type": "BROKERAGE"
        }
      ],
      "positions_count": 24,
      "holdings_value": 489382.0,
      "created_at": "2026-06-09T05:23:29.464897Z",
      "updated_at": "2026-06-09T05:23:29.464898Z"
    }
  ]
}
```

### Fields

| Field | Type | Description |
|---|---|---|
| `id` | `int` | Document ID. |
| `name` | `string` | Original filename. |
| `display_name` | `string` | Human-friendly name. Auto-generated as `"{Broker} - {date} Statement"` after parsing. Empty if not yet processed. |
| `description` | `string` | User-provided description. |
| `file` | `string` | File path (relative). |
| `file_url` | `string` | Absolute URL to download the file. |
| `file_size` | `int \| null` | File size in bytes. |
| `content_type` | `string` | MIME type (e.g. `application/pdf`). |
| `broker` | `string` | Detected broker name (e.g. `zerodha`, `groww`, `ibkr`). Empty if not parsed or undetected. |
| `document_type` | `string` | One of: `investments`, `tax`, `other`. Empty if not set. |
| `processing_status` | `string` | One of: `pending`, `processing`, `processed`, `failed`. |
| `uploaded_by` | `int` | User ID. |
| `uploaded_by_username` | `string` | Username of uploader. |
| `accounts` | `object[]` | Accounts linked via extracted positions. Each has `id`, `name`, `institution_name`, `account_type`. |
| `positions_count` | `int` | Number of position snapshots linked to this document. |
| `holdings_value` | `float \| null` | Sum of `market_value_amount` across all linked positions. Null if no positions. |
| `created_at` | `string` | ISO 8601. |
| `updated_at` | `string` | ISO 8601. |

### Processing Status Lifecycle

| Status | When |
|---|---|
| `pending` | Document uploaded directly (not via broker-statement parser). |
| `processing` | Broker statement upload in progress. |
| `processed` | Broker statement parsed and positions stored successfully. |
| `failed` | Broker statement parsing failed. |

### Upload (POST)

Multipart form-data. Fields: `file` (required), `name` (optional), `description` (optional).

Returns `201 Created` with the document object. Max documents per user is controlled by `BROKER_STATEMENT_MAX_DOCUMENTS` setting.

### Positions Sub-endpoint

**`GET /api/wealth/oneview/documents/{id}/positions/`**

```json
{
  "positions": [
    {
      "id": 1,
      "security_name": "AARTI IND-EQ RS.5",
      "ticker": null,
      "isin": "INE769A01020",
      "asset_type": "equity",
      "currency": "INR",
      "as_of_date": "2026-04-30",
      "quantity": "100.000",
      "cost_basis": null,
      "cost_basis_currency": "INR",
      "market_value": "50720.000",
      "market_value_currency": "INR",
      "account_name": "Zerodha - BFH120"
    }
  ],
  "count": 24
}
```

### Error Responses

| Status | Body | Cause |
|---|---|---|
| `400` | `{"detail": "Document limit reached..."}` | Max document count exceeded. |
| `401` | — | Missing or invalid auth token. |
| `404` | — | Document not found or belongs to another user. |

### Example

```bash
curl https://<host>/api/wealth/oneview/documents/ \
  -H "Authorization: Token YOUR_TOKEN"
```

---

## Wealth Currencies

**`GET /api/wealth/currencies/`**

Returns the currencies currently available on the backend for use in the `currency` field/query param for wealth display endpoints such as `POST /api/wealth/portfolio-view/` and `POST /api/wealth/valuations-view/`.

### Authentication

```
Authorization: Token <token>
```

### Success Response (`200 OK`)

```json
{
  "currencies": [
    {
      "currency_code": "INR",
      "name": "Indian Rupee",
      "symbol": "Rs",
      "decimals": 2
    },
    {
      "currency_code": "USD",
      "name": "US Dollar",
      "symbol": "$",
      "decimals": 2
    }
  ]
}
```

### Fields

| Field | Type | Description |
|---|---|---|
| `currency_code` | `string` | Currency code accepted by wealth display endpoints. |
| `name` | `string \| null` | Human-readable currency name. |
| `symbol` | `string \| null` | Display symbol. |
| `decimals` | `int` | Preferred decimal precision for display. |

---

## Portfolio View

**`POST /api/wealth/portfolio-view/`**

Returns a full portfolio snapshot for a set of accounts — positions merged across accounts, per-account summaries, asset allocation breakdown, and aggregate P&L. All monetary values are converted to the requested display currency.

The frontend calls this endpoint on initial load and again whenever the user adds/removes an account or changes the display currency.

### Authentication

Token-based. Include the token in the `Authorization` header.

```
Authorization: Token <token>
```

### Request Body

```json
{
  "account_ids": [1, 2],
  "currency": "USD",
  "date": "2026-05-22"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `account_ids` | `int[]` | No | Account IDs to include. Pass an empty array `[]` or omit entirely to include **all** active accounts for the client. |
| `currency` | `string` | No | 3-letter ISO currency code for display. Defaults to the client's `base_currency`. All monetary values in the response are converted to this currency. Valid values can be discovered via `GET /api/wealth/currencies/`. |
| `date` | `string` | No | As-of date in `YYYY-MM-DD` format. Defaults to today. The most recent snapshot on or before this date is used per account. |

### Response

```json
{
  "as_of_date": "2026-05-22",
  "currency": "USD",
  "last_updated_at": "2026-05-21T10:16:44.327891+00:00",
  "summary": {
    "total_market_value": 15662.14,
    "total_cost_basis": 12476.60,
    "total_cash": 0.0,
    "total_gain_amount": 3185.54,
    "total_gain_pct": 25.5321
  },
  "accounts": [
    {
      "account_id": 1,
      "account_name": "Vested - Main",
      "institution_name": "vested",
      "base_currency": "USD",
      "market_value": 10585.26,
      "cost_basis": 6934.65,
      "cash": 0.0,
      "gain_amount": 3650.61,
      "gain_pct": 52.643,
      "snapshot_date": "2026-05-21",
      "position_count": 7
    }
  ],
  "positions": [
    {
      "ticker": "VOO",
      "name": "S&P 500 Vanguard ETF",
      "isin": "",
      "asset_type": "ETF",
      "quantity": 8.056,
      "market_value": 5474.21,
      "cost_basis": 4500.97,
      "gain_amount": 973.24,
      "gain_pct": 21.6229,
      "weight_pct": 34.9519,
      "currency": "USD",
      "account_ids": [1]
    }
  ],
  "asset_allocation": {
    "EQUITY": {
      "market_value": 6625.30,
      "weight_pct": 42.3014
    },
    "ETF": {
      "market_value": 9036.84,
      "weight_pct": 57.6986
    }
  },
  "asset_allocation_by_broker": {
    "vested": {
      "EQUITY": {
        "market_value": 1548.42,
        "weight_pct": 9.8864
      },
      "ETF": {
        "market_value": 9036.84,
        "weight_pct": 57.6986
      }
    },
    "zerodha": {
      "EQUITY": {
        "market_value": 5076.88,
        "weight_pct": 32.415
      }
    }
  },
  "sector_allocation": {
    "Technology": {
      "market_value": 4836.11,
      "weight_pct": 30.8762
    },
    "Financial Services": {
      "market_value": 3219.64,
      "weight_pct": 20.5538
    },
    "Unclassified": {
      "market_value": 197.55,
      "weight_pct": 1.2616
    }
  }
}
```

#### `summary`

| Field | Type | Description |
|---|---|---|
| `total_market_value` | `float` | Sum of market values of all positions across all selected accounts, in display currency. |
| `total_cost_basis` | `float` | Sum of cost bases across all selected accounts, in display currency. |
| `total_cash` | `float` | Sum of cash balances across all selected accounts, in display currency. |
| `total_gain_amount` | `float` | `total_market_value - total_cost_basis` |
| `total_gain_pct` | `float \| null` | `(total_gain_amount / total_cost_basis) * 100`. Null if cost basis is zero. |

#### `accounts[]`

One entry per account that was found and active.

| Field | Type | Description |
|---|---|---|
| `account_id` | `int` | |
| `account_name` | `string` | |
| `institution_name` | `string \| null` | Broker/institution name (e.g. `"vested"`, `"zerodha"`). |
| `base_currency` | `string` | Native currency of the account. |
| `market_value` | `float` | In display currency. |
| `cost_basis` | `float` | In display currency. |
| `cash` | `float` | Cash balance in display currency. |
| `gain_amount` | `float` | In display currency. |
| `gain_pct` | `float \| null` | |
| `snapshot_date` | `string \| null` | Date of the most recent snapshot used (`YYYY-MM-DD`). Null if the account has no snapshot data yet. |
| `position_count` | `int` | Number of positions in the snapshot. |

#### `positions[]`

Positions are merged across accounts (same ISIN or ticker is combined into one row). Sorted by `market_value` descending.

| Field | Type | Description |
|---|---|---|
| `ticker` | `string` | For equities/ETFs: the ticker symbol (e.g. `"AAPL"`). For mutual funds (`asset_type: "MUTUAL_FUND"`): the scheme name (same as `name`). |
| `name` | `string` | Security name. For mutual funds, always the full AMFI scheme name (e.g. `"ICICI Prudential All Seasons Bond Fund - Direct Plan - Growth"`), resolved from `PortfolioListing.security_name`. |
| `isin` | `string` | Empty string if unavailable. |
| `asset_type` | `string` | e.g. `"EQUITY"`, `"ETF"`, `"MUTUAL_FUND"`. |
| `quantity` | `float` | Total quantity across all selected accounts. |
| `market_value` | `float` | In display currency. |
| `cost_basis` | `float` | In display currency. |
| `gain_amount` | `float` | `market_value - cost_basis` |
| `gain_pct` | `float \| null` | Null if cost basis is zero. |
| `weight_pct` | `float \| null` | Position's share of total portfolio value (market value + cash). Null if total is zero. |
| `currency` | `string` | Always the requested display currency. |
| `account_ids` | `int[]` | Which accounts hold this position (useful for cross-account merges). |

#### Top-level fields

| Field | Type | Description |
|---|---|---|
| `as_of_date` | `string` | The as-of date used for the snapshot (`YYYY-MM-DD`). |
| `currency` | `string` | Display currency for all monetary values. |
| `last_updated_at` | `string \| null` | ISO 8601 datetime of the most recently computed snapshot across all selected accounts. Null if no snapshots exist. Use this to show the user when the data was last refreshed. |

#### `asset_allocation`

Keys are asset type strings (same values as `positions[].asset_type`). `CASH` is added as a bucket if any account has a cash balance.

| Field | Type | Description |
|---|---|---|
| `market_value` | `float` | Total market value for this asset type, in display currency. |
| `weight_pct` | `float \| null` | Share of total portfolio value. |

#### `asset_allocation_by_broker`

Same structure as `asset_allocation`, but nested one level deeper by broker (`account.institution_name`). Accounts with no `institution_name` are grouped under `"Unknown"`. The `weight_pct` values use the same denominator as `asset_allocation` (total portfolio value), so weights across all brokers sum to 100%.

```
{
  "<institution_name>": {
    "<asset_type>": {
      "market_value": float,
      "weight_pct": float | null
    }
  }
}

#### `sector_allocation`

Sector exposure for invested holdings only. Mutual funds are expanded using the latest synced Morningstar constituent weights from the marketdata DB. Non-mutual-fund holdings are classified by matching the holding name against the synced Morningstar holdings corpus. Holdings that cannot be classified are grouped under `"Unclassified"`.

The `weight_pct` values use the total classified invested market value in `sector_allocation` as the denominator, so the sector weights sum to 100% across the returned buckets. Cash is excluded.

```
{
  "<sector_name>": {
    "market_value": float,
    "weight_pct": float | null
  }
}
```
```

### Notes on FX conversion

- Conversion uses cached FX rates only (no live fetch at request time). If a rate is unavailable for a position's currency, that position contributes `0` to market value and cost basis totals.
- For best results, ensure FX rates are kept up to date via the `fetch_fx_rates` management command.
- If `currency` equals the account's native currency, no conversion is applied.

### Error responses

| Status | Body | Cause |
|---|---|---|
| `400` | `{"detail": "account_ids must be a list of integers."}` | `account_ids` was provided but is not a list of integers. |
| `401` | — | Missing or invalid auth token. |

### Example: all accounts in INR

```bash
curl -X POST https://<host>/api/wealth/portfolio-view/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"currency": "INR"}'
```

### Example: specific accounts, historical date

```bash
curl -X POST https://<host>/api/wealth/portfolio-view/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"account_ids": [1, 3], "currency": "USD", "date": "2026-04-01"}'
```

---

## Valuations View

**`POST /api/wealth/valuations-view/`**

Returns time-series valuation data for plotting the valuations graph. The response includes:

- **`price_series`** — a daily series computed from per-position quantities × market prices from the marketdata DB. This is the primary series for graphing — one point per trading day, mirroring what the `/wealth/valuation/` frontend page displays.
- **`series`** — a sparse series at broker statement upload dates only, including cost basis and gain data. Useful for P&L overlays.
- **`accounts[]`** — per-account breakdown at snapshot dates.

### Authentication

Same token-based auth as all other wealth endpoints.

```
Authorization: Token <token>
```

### Request Body

```json
{
  "account_ids": [1, 2],
  "currency": "USD",
  "from_date": "2026-01-01",
  "to_date": "2026-05-22"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `account_ids` | `int[]` | No | Account IDs to include. Pass `[]` or omit to include **all** active accounts. |
| `currency` | `string` | No | 3-letter ISO display currency. Defaults to `client.base_currency`. Valid values can be discovered via `GET /api/wealth/currencies/`. |
| `from_date` | `string` | No | `YYYY-MM-DD`. Defaults to 1 year before `to_date`. |
| `to_date` | `string` | No | `YYYY-MM-DD`. Defaults to today. |

### Response

```json
{
  "from_date": "2025-05-24",
  "to_date": "2026-05-24",
  "currency": "USD",
  "last_updated_at": "2026-05-21T10:16:44.327891+00:00",
  "summary": {
    "total_market_value": 15662.14,
    "total_cost_basis": 12476.60,
    "total_gain_amount": 3185.53,
    "total_gain_pct": 25.532
  },
  "price_series": [
    { "date": "2026-04-24", "market_value": 15721.24 },
    { "date": "2026-04-25", "market_value": 15807.90 },
    { "date": "2026-05-20", "market_value": 15662.14 }
  ],
  "series": [
    {
      "date": "2026-05-12",
      "market_value": 5216.56,
      "cost_basis": 5611.70,
      "gain_amount": -395.14
    },
    {
      "date": "2026-05-21",
      "market_value": 15662.14,
      "cost_basis": 12476.60,
      "gain_amount": 3185.53
    }
  ],
  "accounts": [
    {
      "account_id": 1,
      "account_name": "Vested - Main",
      "institution_name": "vested",
      "base_currency": "USD",
      "series": [
        {
          "date": "2026-05-21",
          "market_value": 10585.26,
          "cost_basis": 6934.65,
          "gain_amount": 3650.61
        }
      ]
    }
  ]
}
```

#### Top-level fields

| Field | Type | Description |
|---|---|---|
| `from_date` | `string` | Start of the date range used (`YYYY-MM-DD`). |
| `to_date` | `string` | End of the date range used (`YYYY-MM-DD`). |
| `currency` | `string` | Display currency for all monetary values. |
| `last_updated_at` | `string \| null` | ISO 8601 datetime of the most recently computed snapshot within the queried date range. Null if no snapshots exist. |

#### `summary`

Values from the latest data point in the snapshot-based `series`.

| Field | Type | Description |
|---|---|---|
| `total_market_value` | `float` | Portfolio market value at the latest snapshot date, in display currency. |
| `total_cost_basis` | `float` | Total cost basis at the latest snapshot date, in display currency. |
| `total_gain_amount` | `float` | `total_market_value - total_cost_basis` |
| `total_gain_pct` | `float \| null` | `(total_gain_amount / total_cost_basis) * 100`. Null if cost basis is zero. |

#### `price_series[]`

**Primary series for graphing.** Daily portfolio value computed from per-position quantities × market prices, aggregated across all selected accounts. One point per trading day (weekends and market holidays are absent). Prices and FX rates carry forward from the last known date.

The computation mirrors the `/wealth/valuation/` frontend page:
- Positions with price history in the marketdata DB: `quantity × price × fx_rate`
- Positions without price history (e.g. unlisted securities): carried at their last snapshot `market_value × fx_rate`

An empty array is returned if no price data is available for the requested date range.

| Field | Type | Description |
|---|---|---|
| `date` | `string` | `YYYY-MM-DD` (trading days only) |
| `market_value` | `float` | Total portfolio market value in display currency. |

#### `series[]`

Snapshot-based aggregated time series. One point per broker statement upload date. Sparse — typically a few points per month. Includes cost basis and gain data not available in `price_series`.

| Field | Type | Description |
|---|---|---|
| `date` | `string` | `YYYY-MM-DD` |
| `market_value` | `float` | Total market value across all accounts in display currency. |
| `cost_basis` | `float` | Total cost basis across all accounts in display currency. |
| `gain_amount` | `float` | `market_value - cost_basis` |

#### `accounts[]`

Per-account breakdown at snapshot dates. Each account only contains dates where it has an actual snapshot (no carry-forward).

| Field | Type | Description |
|---|---|---|
| `account_id` | `int` | |
| `account_name` | `string` | |
| `institution_name` | `string \| null` | |
| `base_currency` | `string` | Native currency of the account. |
| `series` | `object[]` | Same shape as top-level `series`. Values in display currency. |

### Notes on FX conversion

- `price_series`: FX rates are fetched from the marketdata DB for each day. If a rate is missing for a given day, the last known rate is carried forward.
- `series`: Uses cached rates keyed to the snapshot date. If no rate is found, that position contributes `null` to totals (excluded).
- No live FX fetch is performed at request time. Keep rates up to date with the `fetch_fx_rates` management command.

### Error responses

| Status | Body | Cause |
|---|---|---|
| `400` | `{"detail": "account_ids must be a list of integers."}` | `account_ids` provided but not a list of integers. |
| `401` | — | Missing or invalid auth token. |

### Example: all accounts in INR

```bash
curl -X POST https://<host>/api/wealth/valuations-view/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"currency": "INR"}'
```

### Example: one account, custom date range

```bash
curl -X POST https://<host>/api/wealth/valuations-view/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"account_ids": [2], "currency": "INR", "from_date": "2026-05-01", "to_date": "2026-05-22"}'
```

---

## Icon Proxy

**`GET /api/wealth/icon/<symbol>/`**

Returns a `302` redirect to the logo image for a given ticker symbol via [logo.dev](https://logo.dev). The redirect URL and the response itself are both cached for `ICON_CACHE_TTL` seconds (default 24h).

### Authentication

```
Authorization: Token <token>
```

### Path parameter

| Parameter | Description |
|---|---|
| `symbol` | Ticker symbol (e.g. `AAPL`, `RELIANCE`, `VOO`). URL-encoded symbols are decoded automatically. |

### Response

`302 Found` with a `Location` header pointing to the logo image URL. Both `Cache-Control` and `Expires` headers are set so browsers and CDNs cache the redirect for the configured TTL.

```
Location: https://img.logo.dev/ticker/AAPL?token=<token>&retina=true
Cache-Control: public, max-age=86400
```

### Error responses

| Status | Body | Cause |
|---|---|---|
| `401` | — | Missing or invalid auth token. |

### Settings

| Variable | Default | Description |
|---|---|---|
| `ICON_CACHE_TTL` | `86400` | Cache duration in seconds for both server-side (`cache_page`) and client-side (`Cache-Control`) caching. |
| `TICKER_ICON_TOKEN` | — | logo.dev API token. |

### Example

```bash
curl -v -H "Authorization: Token <token>" \
  https://<host>/api/wealth/icon/AAPL/
```

---

## Passwordless Auth

Email-only sign-in flow. Works for both new and returning users — no password required. All three endpoints are public (no auth token needed).

Base path: `/api/wealth/auth/passwordless/`

---

### 1. Send OTP

**`POST /api/wealth/auth/passwordless/send-otp/`**

Sends a 6-digit OTP to the given email. Creates a pending challenge regardless of whether the account already exists.

**Request**
```json
{ "email": "jane@example.com" }
```

**Response `200`**
```json
{ "message": "OTP sent to jane@example.com", "email": "jane@example.com" }
```

**Error responses**

| Status | `error` value |
|---|---|
| `400` | `email is required.` |
| `400` | `Enter a valid email address.` |
| `502` | `Failed to send sign-in code. Please try again.` |

---

### 2. Verify OTP

**`POST /api/wealth/auth/passwordless/verify/`**

Submits the OTP. Logs in an existing user or creates a new account if the email is unrecognised.

**Request**
```json
{ "email": "jane@example.com", "otp": "482910" }
```

**Response `200`** — existing user
```json
{
  "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b",
  "user": { "id": 1, "email": "jane@example.com", "display_name": "Jane Smith" },
  "created": false
}
```

**Response `201`** — new account created
```json
{
  "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b",
  "user": { "id": 5, "email": "jane@example.com", "display_name": "jane" },
  "created": true
}
```

> New accounts are created with no password — they cannot use `POST /login/` unless a password is set separately. `display_name` defaults to the email prefix (part before `@`).

Use the `created` flag to decide whether to redirect to onboarding (`true`) or the dashboard (`false`).

**Error responses**

| Status | `error` value |
|---|---|
| `400` | `email and otp are required.` |
| `400` | `No pending sign-in request for this email. Please request a new code.` |
| `400` | `OTP has expired. Please request a new code.` |
| `400` | `Too many incorrect attempts. Please request a new code.` |
| `400` | `Incorrect OTP. N attempt(s) remaining.` |
| `401` | `This account has been deactivated.` |

---

### 3. Resend OTP

**`POST /api/wealth/auth/passwordless/resend-otp/`**

Resends a fresh OTP. Rate-limited to once per **60 seconds**.

**Request**
```json
{ "email": "jane@example.com" }
```

**Response `200`**
```json
{ "message": "OTP resent to jane@example.com" }
```

**Error responses**

| Status | `error` value |
|---|---|
| `400` | `email is required.` |
| `400` | `No pending sign-in request for this email. Please request a new code.` |
| `429` | `Please wait N second(s) before requesting a new code.` |
| `502` | `Failed to resend code. Please try again.` |

---

### Flow summary

```
POST /passwordless/send-otp/   { email }        → OTP sent
POST /passwordless/verify/     { email, otp }   → token + created flag
POST /passwordless/resend-otp/ { email }        → new OTP sent (60s cooldown)
```

---

## Client Me

**`GET /api/wealth/auth/me/`** — get client name, email, and PAN number
**`PATCH /api/wealth/auth/me/`** — update client display name and/or PAN number

Used in the post-sign-in onboarding step where the frontend collects the user's real name (e.g. after a passwordless OTP sign-in creates an account with a placeholder name).

The PATCH also creates or updates the `Customer` record in the customers table and links it to the `one-view` application when the name is updated.

### Authentication

```
Authorization: Token <token>
```

---

### GET — client details

**`GET /api/wealth/auth/me/`**

**Response `200`**
```json
{ "name": "Jane Smith", "email": "jane@example.com", "pan_number": "ABCDE1234F" }
```

| Field | Type | Description |
|---|---|---|
| `name` | `string` | `client.display_name`. May be the email prefix (e.g. `"jane"`) if the user signed up via passwordless OTP and has not set a name yet. |
| `email` | `string` | The user's email address. |
| `pan_number` | `string \| null` | Indian PAN number (10 characters, uppercase). Null if not set. |

**Error responses**

| Status | Body | Cause |
|---|---|---|
| `401` | — | Missing or invalid auth token. |
| `404` | `{"error": "No client profile found."}` | Authenticated user has no associated client record. |

---

### PATCH — update display name and/or PAN number

**`PATCH /api/wealth/auth/me/`**

All fields are optional, but at least one must be provided.

**Request**
```json
{ "name": "Jane Smith", "pan_number": "ABCDE1234F" }
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | No | New display name. Must be non-empty after trimming whitespace. |
| `pan_number` | `string` | No | Indian PAN number (10 characters). Auto-uppercased. Send an empty string `""` to clear. |

**Response `200`**
```json
{ "name": "Jane Smith", "email": "jane@example.com", "pan_number": "ABCDE1234F" }
```

**Side effects:**
- Updates `client.display_name` and/or `client.pan_number`.
- If `name` was updated: upserts a `Customer` row (matched by email) in the customers table with the new name, and creates a `CustomerApplicationActivity` row linking the customer to the `one-view` application (no-op if one already exists).

**Error responses**

| Status | Body | Cause |
|---|---|---|
| `400` | `{"error": "name cannot be empty."}` | `name` was provided but blank after trimming. |
| `400` | `{"error": "PAN number must be 10 characters."}` | `pan_number` was provided but not exactly 10 characters (and not empty). |
| `400` | `{"error": "No fields to update."}` | Neither `name` nor `pan_number` was provided. |
| `401` | — | Missing or invalid auth token. |
| `404` | `{"error": "No client profile found."}` | Authenticated user has no associated client record. |

---

### Typical onboarding flow

```
POST /passwordless/verify/  { email, otp }    → token, created=true, display_name="jane"
GET  /auth/me/                                 → { name: "jane", email: "jane@example.com", pan_number: null }
PATCH /auth/me/             { name: "Jane Smith", pan_number: "ABCDE1234F" } → { name: "Jane Smith", ... }
```

---

## Client Profile

**`GET /api/wealth/me/`** — fetch the authenticated client's profile
**`PATCH /api/wealth/me/`** — update writable profile fields

### Authentication

```
Authorization: Token <token>
```

---

### GET — fetch profile

**`GET /api/wealth/me/`**

**Response `200`**
```json
{
  "id": 3,
  "username": "yash@z.inc",
  "email": "yash@z.inc",
  "display_name": "Yash Goyal",
  "pan_number": "ABCDE1234F",
  "base_currency": "INR",
  "timezone": "UTC",
  "is_active": true,
  "mailer_frequency": "WEEKLY",
  "created_at": "2026-05-25T02:42:17.018688Z",
  "updated_at": "2026-05-25T02:42:17.018703Z"
}
```

| Field | Type | Description |
|---|---|---|
| `id` | `int` | Client record ID. Read-only. |
| `username` | `string` | Django username. Read-only. |
| `email` | `string` | User's email address. Read-only. |
| `display_name` | `string` | Human-readable name shown in UI and digest emails. |
| `pan_number` | `string \| null` | Indian PAN number (10 characters, uppercase). Null if not set. |
| `base_currency` | `string` | 3-letter ISO currency code. Used as the default display currency across portfolio views and digest emails. |
| `timezone` | `string` | IANA timezone string (e.g. `"Asia/Kolkata"`). |
| `is_active` | `bool` | Whether the client account is active. |
| `mailer_frequency` | `string` | Digest email cadence. One of `"DAILY"`, `"WEEKLY"`, `"MONTHLY"`. |
| `created_at` | `string` | ISO 8601. Read-only. |
| `updated_at` | `string` | ISO 8601. Read-only. |

**Error responses**

| Status | Cause |
|---|---|
| `401` | Missing or invalid auth token. |

---

### PATCH — update profile

**`PATCH /api/wealth/me/`**

All fields are optional. Only the fields provided are updated.

**Request**
```json
{
  "display_name": "Yash Goyal",
  "base_currency": "USD",
  "timezone": "Asia/Kolkata",
  "mailer_frequency": "DAILY"
}
```

| Field | Type | Description |
|---|---|---|
| `display_name` | `string` | New display name. |
| `base_currency` | `string` | 3-letter ISO currency code (e.g. `"INR"`, `"USD"`). Affects default currency in portfolio views and digest emails. |
| `timezone` | `string` | IANA timezone string. |
| `mailer_frequency` | `string` | One of `"DAILY"`, `"WEEKLY"`, `"MONTHLY"`. Controls how often `send_valuation_digest` sends this client a digest email. |

**Response `200`** — full updated profile (same shape as GET).

**Error responses**

| Status | Body | Cause |
|---|---|---|
| `400` | `{"mailer_frequency": ["\"HOURLY\" is not a valid choice."]}` | Invalid enum value for `mailer_frequency`. |
| `401` | — | Missing or invalid auth token. |

### Examples

```bash
# Fetch profile
curl https://<host>/api/wealth/me/ \
  -H "Authorization: Token <token>"

# Switch to USD and set weekly digest
curl -X PATCH https://<host>/api/wealth/me/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"base_currency": "USD", "mailer_frequency": "WEEKLY"}'

# Set daily digest
curl -X PATCH https://<host>/api/wealth/me/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"mailer_frequency": "DAILY"}'
```

---

## Sankey Chart

**`POST /api/wealth/sankey/`**

Returns nodes and links for rendering a portfolio Sankey (flow) chart. The grouping is fixed at `account → asset_type → instrument`.

### Authentication

```
Authorization: Token <token>
```

### Request Body

```json
{
  "account_ids": [1, 2],
  "currency": "INR",
  "date": "2026-05-26"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `account_ids` | `int[]` | No | Accounts to include. Omit or pass `[]` for all active accounts. |
| `currency` | `string` | No | 3-letter ISO display currency. Defaults to `client.base_currency`. |
| `date` | `string` | No | As-of date `YYYY-MM-DD`. Defaults to today. |

### Response

```json
{
  "as_of_date": "2026-05-26",
  "currency": "USD",
  "group_by": "account_asset_type_instrument",
  "totals": {
    "market_value": 15662.14,
    "cost_basis": 12476.60,
    "cash": 0.0,
    "gain_amount": 3185.53,
    "gain_pct": 25.53
  },
  "nodes": [...],
  "links": [...],
  "metadata": {
    "generated_at": "2026-05-26T07:33:15.125496+00:00",
    "data_source": "portfolio_positions",
    "value_basis": "market_value",
    "has_uncategorized": false,
    "min_link_value": 0.01
  }
}
```

#### `totals`

| Field | Type | Description |
|---|---|---|
| `market_value` | `float` | Total market value across all positions, in display currency. |
| `cost_basis` | `float` | Total cost basis, in display currency. |
| `cash` | `float` | Total cash balances, in display currency. |
| `gain_amount` | `float` | `market_value - cost_basis` |
| `gain_pct` | `float \| null` | `(gain_amount / cost_basis) * 100`. Null if cost basis is zero. |

#### `nodes[]`

Four node types across four levels:

| Level | `type` | `id` pattern | Description |
|---|---|---|---|
| 0 | `portfolio` | `portfolio:oneview` | Single root node representing the whole view. |
| 1 | `account` | `account:{id}` | One node per active account. |
| 2 | `asset_type` | `asset_type:{AT}` | One node per distinct asset type across all accounts. |
| 3 | `instrument` | `instrument:{isin_or_ticker}` | One node per unique instrument (ISIN preferred over ticker). |

All nodes share these base fields:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique node identifier (used in `links[].from` / `links[].to`). |
| `label` | `string` | Short display label. Instrument labels have common MF suffixes stripped and are truncated to 30 chars. |
| `type` | `string` | `portfolio`, `account`, `asset_type`, or `instrument`. |
| `level` | `int` | `0`–`3`. |
| `color` | `string` | Hex color. Deterministic: portfolio=#2F9FF8; accounts cycle a fixed palette; asset types have a fixed color map; instruments inherit their asset type's color. |
| `sort_order` | `int` | 1-based rank within the level, sorted by market value descending. |

Account nodes include a `metadata` object:

```json
{
  "account_id": 2,
  "institution_name": "zerodha",
  "position_count": 24
}
```

Instrument nodes include a `metadata` object:

```json
{
  "ticker": "VOO",
  "name": "S&P 500 Vanguard ETF",
  "isin": "",
  "gain_pct": 21.62,
  "weight_pct": 34.95
}
```

| Field | Description |
|---|---|
| `ticker` | Ticker symbol (empty string if unavailable). |
| `name` | Full instrument name (resolved via: `positions_json.name` → `PortfolioListing.security_name` → marketdata DB → ticker/ISIN fallback). |
| `isin` | ISIN (empty string if unavailable). |
| `gain_pct` | `(market_value - cost_basis) / cost_basis * 100`. Null if cost basis is zero. |
| `weight_pct` | Instrument's share of total portfolio value (positions + cash). Null if total is zero. |

#### Asset type color map

| Asset type | Color |
|---|---|
| `EQUITY` | `#4CAF50` |
| `ETF` | `#2196F3` |
| `MUTUAL_FUND` | `#7C5CFF` |
| `BOND` | `#607D8B` |
| `DEBT` | `#78909C` |
| `CASH` | `#9E9E9E` |
| `REIT` | `#FF9800` |
| `COMMODITY` | `#D4AF37` |
| `CRYPTO` | `#FF6B35` |
| Any other | `#90A4AE` |

#### `links[]`

Three tiers of links:

| Tier | `from` | `to` | `value` |
|---|---|---|---|
| 1 | `portfolio:oneview` | `account:{id}` | Total account market value |
| 2 | `account:{id}` | `asset_type:{AT}` | Market value of that asset type within that account |
| 3 | `asset_type:{AT}` | `instrument:{key}` | Total instrument market value across all accounts |

Each link:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | `{from}->{to}` |
| `from` | `string` | Source node id. |
| `to` | `string` | Target node id. |
| `value` | `float` | Flow value in display currency. |
| `currency` | `string` | Display currency. |

#### `metadata`

| Field | Type | Description |
|---|---|---|
| `generated_at` | `string` | ISO 8601 timestamp of when the response was built. |
| `data_source` | `string` | Always `"portfolio_positions"`. |
| `value_basis` | `string` | Always `"market_value"`. |
| `has_uncategorized` | `bool` | `true` if any position has `asset_type = "OTHER"`. |
| `min_link_value` | `float` | Minimum link value threshold (informational, currently `0.01`). |

### Notes

- Instrument names are resolved from four sources in priority order: `positions_json.name` → `PortfolioListing.security_name` → marketdata SQLite DB (by ticker then ISIN) → ticker/ISIN fallback.
- If two accounts hold the same instrument (same ISIN or ticker), a single instrument node is emitted with the combined value. Separate `account → asset_type` links are still emitted per account.
- FX conversion uses cached rates only (no live fetch). If a rate is missing, that position is excluded from totals.

### Error responses

| Status | Body | Cause |
|---|---|---|
| `400` | `{"detail": "account_ids must be a list of integers."}` | `account_ids` provided but not a valid integer list. |
| `401` | — | Missing or invalid auth token. |

### Examples

```bash
# All accounts in INR
curl -X POST https://<host>/api/wealth/sankey/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"currency": "INR"}'

# Specific account, USD
curl -X POST https://<host>/api/wealth/sankey/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"account_ids": [1], "currency": "USD", "date": "2026-05-26"}'
```

---

## Jobs List

**`GET /api/wealth/oneview/broker-statements/jobs/`**

Returns active and recent parse jobs for the authenticated user. Lets the frontend recover in-progress `job_id`s after a page reload without losing track of background processing.

### Authentication

```
Authorization: Token <token>
```

### Filtering

- Jobs with status `queued`, `running`, or `needs_review` — always returned
- Jobs with status `completed` or `failed` — only returned if updated within the last 24 hours

Results are ordered by `created_at` descending, limited to 50.

### Response (`200 OK`)

```json
[
  {
    "job_id": "a1b2c3d4e5f6",
    "status": "running",
    "original_filename": "groww_holdings.xlsx",
    "document_id": 42,
    "created_at": "2026-06-10T08:30:00Z",
    "updated_at": "2026-06-10T08:30:12Z",
    "progress": {
      "label": "Extracting holdings with AI...",
      "current": 2,
      "total": 5
    },
    "broker_detected": "groww",
    "positions_count": null,
    "error_summary": null
  },
  {
    "job_id": "f6e5d4c3b2a1",
    "status": "failed",
    "original_filename": "unknown.pdf",
    "document_id": 43,
    "created_at": "2026-06-10T07:15:00Z",
    "updated_at": "2026-06-10T07:15:30Z",
    "progress": null,
    "broker_detected": null,
    "positions_count": null,
    "error_summary": "Unsupported document format"
  }
]
```

### Fields

| Field | Type | Description |
|---|---|---|
| `job_id` | `string` | Job identifier (use with `/jobs/{job_id}/status/` to poll). |
| `status` | `string` | One of: `queued`, `running`, `completed`, `failed`, `needs_review`. |
| `original_filename` | `string` | Uploaded filename. |
| `document_id` | `int \| null` | Associated Document ID (from metadata). |
| `created_at` | `string` | ISO 8601 when the job was created. |
| `updated_at` | `string` | ISO 8601 when the job was last updated. |
| `progress` | `object \| null` | Only present for `queued`/`running` status. Contains `label`, `current`, `total`. |
| `broker_detected` | `string \| null` | Broker name if detected. |
| `positions_count` | `int \| null` | Number of positions extracted (null while processing). |
| `error_summary` | `string \| null` | Failure message for `failed` jobs, null otherwise. |

### Example

```bash
curl https://<host>/api/wealth/oneview/broker-statements/jobs/ \
  -H "Authorization: Token YOUR_TOKEN"
```

---

## Activity Stream

**`GET /api/wealth/oneview/activity/`**

Returns a generic activity feed for the authenticated user. The response contract is stable — new event sources will be added in the future without changing the shape.

Currently powered by document upload/parse events. Will extend to cover account linking, valuation refreshes, and other system events.

### Authentication

```
Authorization: Token <token>
```

### Response (`200 OK`)

```json
[
  {
    "id": "pj_a1b2c3d4e5f6",
    "event_type": "document_upload",
    "title": "groww_holdings.xlsx",
    "subtitle": "12 positions imported to Main Portfolio",
    "status": "success",
    "status_detail": null,
    "metadata": {
      "document_id": 42,
      "portfolio_name": "Main Portfolio",
      "portfolio_id": 7,
      "broker": "groww",
      "positions_count": 12
    },
    "created_at": "2026-06-10T08:30:00Z",
    "completed_at": "2026-06-10T08:30:45Z"
  },
  {
    "id": "pj_f6e5d4c3b2a1",
    "event_type": "document_upload",
    "title": "unknown_statement.pdf",
    "subtitle": "Processing failed",
    "status": "failed",
    "status_detail": "Unsupported document format",
    "metadata": {
      "document_id": 43
    },
    "created_at": "2026-06-10T07:15:00Z",
    "completed_at": "2026-06-10T07:15:30Z"
  }
]
```

### Fields (stable contract)

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique activity item identifier. Prefixed by source (e.g. `pj_` for parse jobs). |
| `event_type` | `string` | Event category. Currently: `document_upload`. Future: `account_link`, `valuation_refresh`, etc. |
| `title` | `string` | Primary display text (e.g. filename). |
| `subtitle` | `string` | Secondary display text (e.g. "12 positions imported to Main Portfolio"). |
| `status` | `string` | One of: `pending`, `processing`, `success`, `failed`, `needs_review`. |
| `status_detail` | `string \| null` | Human-readable error message for `failed` status, null otherwise. |
| `metadata` | `object` | Event-specific data. Shape varies by `event_type`. |
| `created_at` | `string` | ISO 8601 when the event started. |
| `completed_at` | `string \| null` | ISO 8601 when the event reached a terminal state. Null if still in progress. |

### Status Values

| Status | Meaning |
|---|---|
| `pending` | Queued, not yet started. |
| `processing` | Actively being processed. |
| `success` | Completed successfully. |
| `failed` | Completed with an error. |
| `needs_review` | Requires user action before proceeding. |

### Example

```bash
curl https://<host>/api/wealth/oneview/activity/ \
  -H "Authorization: Token YOUR_TOKEN"
```