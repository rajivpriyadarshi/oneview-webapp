# New APIs

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
| `currency` | `string` | No | 3-letter ISO currency code for display. Defaults to the client's `base_currency`. All monetary values in the response are converted to this currency. |
| `date` | `string` | No | As-of date in `YYYY-MM-DD` format. Defaults to today. The most recent snapshot on or before this date is used per account. |

### Response

```json
{
  "as_of_date": "2026-05-22",
  "currency": "USD",
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
      "market_value": 14000.00,
      "weight_pct": 89.39
    },
    "ETF": {
      "market_value": 1662.14,
      "weight_pct": 10.61
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
| `ticker` | `string` | |
| `name` | `string` | Security name. |
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

#### `asset_allocation`

Keys are asset type strings (same values as `positions[].asset_type`). `CASH` is added as a bucket if any account has a cash balance.

| Field | Type | Description |
|---|---|---|
| `market_value` | `float` | Total market value for this asset type, in display currency. |
| `weight_pct` | `float \| null` | Share of total portfolio value. |

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

Returns time-series valuation data for plotting the valuations graph — portfolio value, cost basis, and gain over time. Includes both an aggregated series across all selected accounts and a per-account breakdown.

Data source is `HoldingSnapshot` (one entry per account per statement upload). The aggregated series uses all unique snapshot dates across accounts; for each date, the most recent snapshot on-or-before that date is used per account.

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
| `currency` | `string` | No | 3-letter ISO display currency. Defaults to `client.base_currency`. |
| `from_date` | `string` | No | `YYYY-MM-DD`. Defaults to 1 year before `to_date`. |
| `to_date` | `string` | No | `YYYY-MM-DD`. Defaults to today. |

### Response

```json
{
  "from_date": "2025-05-22",
  "to_date": "2026-05-22",
  "currency": "USD",
  "summary": {
    "total_market_value": 15662.14,
    "total_cost_basis": 12476.60,
    "total_gain_amount": 3185.53,
    "total_gain_pct": 25.532
  },
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

#### `summary`

Values from the latest data point in the aggregated series.

| Field | Type | Description |
|---|---|---|
| `total_market_value` | `float` | Portfolio market value at the latest snapshot date, in display currency. |
| `total_cost_basis` | `float` | Total cost basis at the latest snapshot date, in display currency. |
| `total_gain_amount` | `float` | `total_market_value - total_cost_basis` |
| `total_gain_pct` | `float \| null` | `(total_gain_amount / total_cost_basis) * 100`. Null if cost basis is zero. |

#### `series[]`

Aggregated time series across all selected accounts, sorted by date ascending. Suitable for plotting the main portfolio value line.

Each entry represents the portfolio state on that date, using the most recent available snapshot per account as-of that date (so earlier accounts "carry forward" their last known value on dates where they have no new snapshot).

| Field | Type | Description |
|---|---|---|
| `date` | `string` | `YYYY-MM-DD` |
| `market_value` | `float` | Total market value across all accounts in display currency. |
| `cost_basis` | `float` | Total cost basis across all accounts in display currency. |
| `gain_amount` | `float` | `market_value - cost_basis` |

#### `accounts[]`

Per-account breakdown. Each account only contains dates where it actually has a snapshot (no carry-forward).

| Field | Type | Description |
|---|---|---|
| `account_id` | `int` | |
| `account_name` | `string` | |
| `institution_name` | `string \| null` | |
| `base_currency` | `string` | Native currency of the account. |
| `series` | `object[]` | Same shape as top-level `series`. Values in display currency. |

### Notes on data density

Each entry in `series` corresponds to an actual broker statement upload date — there is no daily interpolation. A freshly created account with one uploaded statement will have one point. As more statements are uploaded over time, the series grows. For a smooth graph, the frontend should use a step/area chart rather than a line chart.

### Notes on FX conversion

Same as `portfolio-view`: cached rates only, no live fetch. Positions from accounts whose native currency differs from `currency` will have values converted using the FX rate closest to the snapshot date. If no rate is found, the position contributes `null` (excluded from totals).

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