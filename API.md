# OneView API Reference

Base URL: `https://<host>/api/v1`

## Authentication

All endpoints except the auth ones require a token in the `Authorization` header:

```
Authorization: Token <token>
```

Tokens are obtained from the login or signup/verify endpoints.

---

## Auth

### Initiate Signup

```
POST /api/v1/auth/signup/
```

Validates input, then sends a 6-digit OTP to the provided email address. The OTP is valid for 10 minutes.

**Request body** (`application/json`)

| Field              | Type   | Required | Notes                     |
|--------------------|--------|----------|---------------------------|
| `name`             | string | yes      | Full name                 |
| `email`            | string | yes      | Used as login identifier  |
| `password`         | string | yes      | Min 8 characters          |
| `confirm_password` | string | yes      | Must match `password`     |
| `phone`            | string | no       | E.164 or local format     |

**Success 200**
```json
{
  "message": "OTP sent to user@example.com",
  "email": "user@example.com"
}
```

**Error 400**
```json
{ "error": "An account with this email already exists." }
```

---

### Verify OTP & Complete Signup

```
POST /api/v1/auth/signup/verify/
```

Verifies the OTP and creates the user account. Returns an auth token on success.

**Request body**

| Field   | Type   | Required |
|---------|--------|----------|
| `email` | string | yes      |
| `otp`   | string | yes      |

**Success 201**
```json
{
  "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "display_name": "Jane Doe"
  }
}
```

**Error 400**
```json
{ "error": "Incorrect OTP. 4 attempts remaining." }
```

---

### Resend OTP

```
POST /api/v1/auth/signup/resend-otp/
```

Resends a new OTP. Rate-limited: minimum 60 seconds between resends.

**Request body**

| Field   | Type   | Required |
|---------|--------|----------|
| `email` | string | yes      |

**Success 200**
```json
{ "message": "OTP resent to user@example.com" }
```

**Error 429** (resend too soon)
```json
{ "error": "Please wait 42 seconds before requesting a new code." }
```

---

### Login

```
POST /api/v1/auth/login/
```

**Request body**

| Field      | Type   | Required |
|------------|--------|----------|
| `email`    | string | yes      |
| `password` | string | yes      |

**Success 200**
```json
{
  "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "display_name": "Jane Doe"
  }
}
```

**Error 401**
```json
{ "error": "Invalid email or password." }
```

---

### Logout

```
POST /api/v1/auth/logout/
```

Invalidates the current token. Requires `Authorization: Token <token>` header.

**Success 204** — no body

---

## Profile

### Get / Update Profile

```
GET  /api/v1/me/
PATCH /api/v1/me/
```

**GET response / PATCH request body fields**

| Field           | Type   | Notes                      |
|-----------------|--------|----------------------------|
| `display_name`  | string | Editable                   |
| `base_currency` | string | e.g. `"USD"` — Editable    |
| `timezone`      | string | e.g. `"Asia/Kolkata"` — Editable |
| `email`         | string | Read-only                  |
| `is_active`     | bool   | Read-only                  |

**Example PATCH request**
```json
{ "display_name": "Jane Doe", "base_currency": "INR" }
```

---

## Portfolios

### List / Create Portfolios

```
GET  /api/v1/portfolios/
POST /api/v1/portfolios/
```

**POST body**

| Field           | Type   | Required | Notes                |
|-----------------|--------|----------|----------------------|
| `name`          | string | yes      |                      |
| `base_currency` | string | yes      | Currency code e.g. `"USD"` |

### Get / Update / Delete Portfolio

```
GET    /api/v1/portfolios/{id}/
PATCH  /api/v1/portfolios/{id}/
DELETE /api/v1/portfolios/{id}/
```

### Portfolio Valuation Summary

```
GET /api/v1/portfolios/{id}/valuation/
```

**Query params**

| Param      | Default     | Notes                        |
|------------|-------------|------------------------------|
| `date`     | today        | `YYYY-MM-DD`                |
| `currency` | portfolio's base currency | |

**Response**
```json
{
  "portfolio_id": 1,
  "portfolio_name": "Main Portfolio",
  "currency": "USD",
  "market_value": "125000.00",
  "cost_basis": "100000.00",
  "gain_amount": "25000.00",
  "gain_pct": "25.0000",
  "accounts": [
    {
      "account_id": 3,
      "account_name": "IBKR",
      "market_value": "125000.00",
      "cost_basis": "100000.00",
      "cash_balance": "5000.00",
      "gain_amount": "25000.00",
      "gain_pct": "25.0000",
      "cumulative_twr": "0.20",
      "currency": "USD"
    }
  ]
}
```

### Queue Portfolio Recompute

```
POST /api/v1/portfolios/{id}/materialize/
```

Queues a full recompute of HoldingSnapshot + DailyValuation for all active accounts.

---

## Accounts

### List / Create Accounts

```
GET  /api/v1/portfolios/{portfolio_id}/accounts/
POST /api/v1/portfolios/{portfolio_id}/accounts/
```

**POST body**

| Field              | Type   | Required | Notes                           |
|--------------------|--------|----------|---------------------------------|
| `name`             | string | yes      |                                 |
| `account_type`     | string | yes      | e.g. `"brokerage"`, `"401k"`   |
| `base_currency`    | string | yes      | Currency code                   |
| `institution_name` | string | no       |                                 |
| `valuation_mode`   | string | no       | `"snapshot_first"` (default)   |

### Get / Update / Delete Account

```
GET    /api/v1/portfolios/{portfolio_id}/accounts/{id}/
PATCH  /api/v1/portfolios/{portfolio_id}/accounts/{id}/
DELETE /api/v1/portfolios/{portfolio_id}/accounts/{id}/
```

DELETE is a **soft-delete** by default (sets `is_active=false`). Pass `?hard=true` for physical deletion.

### Account Valuation Time Series

```
GET /api/v1/portfolios/{portfolio_id}/accounts/{id}/valuation/
```

**Query params**: `from=YYYY-MM-DD`, `to=YYYY-MM-DD`

Returns an array of `DailyValuation` records.

### Account Holdings Snapshot

```
GET /api/v1/portfolios/{portfolio_id}/accounts/{id}/holdings/
```

**Query params**: `date=YYYY-MM-DD` (defaults to today)

Returns the most recent `HoldingSnapshot` on or before the given date.

### Account Performance (TWR)

```
GET /api/v1/portfolios/{portfolio_id}/accounts/{id}/performance/
```

**Query params**: `from=YYYY-MM-DD`, `to=YYYY-MM-DD`

**Response**
```json
{
  "account_id": 3,
  "from_date": "2026-01-01",
  "to_date": "2026-05-21",
  "cumulative_twr": "0.182345",
  "ytd_twr": "0.102100",
  "daily_series": [
    { "valuation_date": "2026-01-02", "daily_twr": "0.001234", "cumulative_twr": "0.001234", "ytd_twr": "0.001234" }
  ]
}
```

---

## Portfolio Listings (Instruments)

```
GET    /api/v1/portfolios/{portfolio_id}/portfolio-listings/
POST   /api/v1/portfolios/{portfolio_id}/portfolio-listings/
GET    /api/v1/portfolios/{portfolio_id}/portfolio-listings/{id}/
PATCH  /api/v1/portfolios/{portfolio_id}/portfolio-listings/{id}/
DELETE /api/v1/portfolios/{portfolio_id}/portfolio-listings/{id}/
```

**Query params (GET list)**

| Param    | Notes                        |
|----------|------------------------------|
| `type`   | Filter by asset type         |
| `active` | `true` — show active only    |

**POST body**

| Field            | Type   | Required |
|------------------|--------|----------|
| `ticker_symbol`  | string | no       |
| `isin`           | string | no       |
| `venue`          | string | no       | e.g. `"nse"`, `"nasdaq"` |
| `currency`       | string | no       |
| `security_name`  | string | no       |
| `type`           | string | yes      | e.g. `"equity"`, `"mutual_fund"` |

### Listing Prices

```
GET  /api/v1/portfolios/{portfolio_id}/portfolio-listings/{id}/prices/
POST /api/v1/portfolios/{portfolio_id}/portfolio-listings/{id}/prices/
DELETE /api/v1/portfolios/{portfolio_id}/portfolio-listings/{id}/prices/{price_id}/
```

**GET query params**: `from`, `to`, `provider`

**POST body**

| Field         | Type   | Required |
|---------------|--------|----------|
| `quote_date`  | string | yes      | `YYYY-MM-DD` |
| `close_price` | number | yes      |
| `currency`    | string | yes      |
| `provider`    | string | no       | default `"manual"` |

---

## Activities (Transactions)

```
GET    /api/v1/portfolios/{portfolio_id}/activities/
POST   /api/v1/portfolios/{portfolio_id}/activities/
GET    /api/v1/portfolios/{portfolio_id}/activities/{id}/
PATCH  /api/v1/portfolios/{portfolio_id}/activities/{id}/
DELETE /api/v1/portfolios/{portfolio_id}/activities/{id}/
```

DELETE: drafts are hard-deleted; confirmed activities are archived (`is_confirmed=false`).

**GET query params**

| Param               | Notes                               |
|---------------------|-------------------------------------|
| `account`           | Filter by account ID                |
| `portfolio_listing` | Filter by listing ID                |
| `type`              | Filter by activity type code        |
| `from`              | `YYYY-MM-DD` — activity date from   |
| `to`                | `YYYY-MM-DD` — activity date to     |
| `is_draft`          | `true` / `false`                    |
| `ordering`          | Field to sort by (default: `-activity_date`) |

### Bulk Import Activities

```
POST /api/v1/portfolios/{portfolio_id}/activities/bulk/
```

**Body**
```json
{
  "activities": [
    {
      "account": 3,
      "activity_type": "BUY",
      "activity_date": "2026-01-15",
      "portfolio_listing": 7,
      "quantity": "100",
      "price_per_unit": "150.00",
      "currency": "USD"
    }
  ]
}
```

**Response 207**
```json
{ "created": 1, "skipped": 0, "errors": [] }
```

---

## Position Snapshots

```
GET    /api/v1/portfolios/{portfolio_id}/accounts/{account_id}/snapshots/
POST   /api/v1/portfolios/{portfolio_id}/accounts/{account_id}/snapshots/
DELETE /api/v1/portfolios/{portfolio_id}/accounts/{account_id}/snapshots/{id}/
```

**GET query params**

| Param               | Notes                                  |
|---------------------|----------------------------------------|
| `date`              | `YYYY-MM-DD` — exact date (defaults to latest) |
| `portfolio_listing` | Filter by listing ID                   |

### Batch Import Snapshots

```
POST /api/v1/portfolios/{portfolio_id}/accounts/{account_id}/snapshots/import/
```

**Body**
```json
{
  "as_of_date": "2026-05-01",
  "positions": [
    {
      "portfolio_listing_id": 7,
      "quantity": "100",
      "cost_basis_amount": "15000.00",
      "cost_basis_currency": "USD",
      "market_value_amount": "17500.00",
      "market_value_currency": "USD"
    }
  ]
}
```

**Response**
```json
{ "created": 1, "updated": 0 }
```

---

## Valuation Overrides

```
GET    /api/v1/portfolios/{portfolio_id}/overrides/
POST   /api/v1/portfolios/{portfolio_id}/overrides/
PATCH  /api/v1/portfolios/{portfolio_id}/overrides/{id}/
DELETE /api/v1/portfolios/{portfolio_id}/overrides/{id}/
```

**GET query params**: `portfolio_listing`, `account`, `date`

---

## Categories

```
GET    /api/v1/portfolios/{portfolio_id}/categories/
POST   /api/v1/portfolios/{portfolio_id}/categories/
PATCH  /api/v1/portfolios/{portfolio_id}/categories/{id}/
DELETE /api/v1/portfolios/{portfolio_id}/categories/{id}/
```

GET list returns root-level categories with nested children.

---

## Net Worth & Valuations

### Net Worth (all portfolios)

```
GET /api/v1/net-worth/
```

**Query params**: `date=YYYY-MM-DD`, `currency=USD`

**Response**
```json
{
  "as_of_date": "2026-05-21",
  "currency": "USD",
  "total_market_value": "250000.00",
  "total_cost_basis": "180000.00",
  "total_gain_amount": "70000.00",
  "total_gain_pct": "38.8889",
  "portfolios": [...]
}
```

### Multi-Account Valuation

```
GET /api/v1/valuations/
```

**Query params**: `accounts=1,2,3`, `date=YYYY-MM-DD`, `currency=USD`

### Trigger Recompute

```
POST /api/v1/materialize/
```

**Body** (all optional)
```json
{
  "portfolio_ids": [1, 2],
  "account_ids": [3, 4],
  "from_date": "2026-01-01",
  "force": false
}
```

---

## Documents

### List / Upload Documents

```
GET  /api/v1/oneview/documents/
POST /api/v1/oneview/documents/
```

POST uses `multipart/form-data`.

**POST fields**

| Field         | Type   | Required | Notes                 |
|---------------|--------|----------|-----------------------|
| `file`        | file   | yes      | Any file type         |
| `name`        | string | no       | Defaults to filename  |
| `description` | string | no       |                       |

**Response**
```json
{
  "id": "uuid",
  "name": "my_statement.pdf",
  "description": "",
  "file": "/media/documents/user_1/my_statement.pdf",
  "file_size": 204800,
  "content_type": "application/pdf",
  "created_at": "2026-05-21T10:00:00Z"
}
```

### Get / Update / Delete Document

```
GET    /api/v1/oneview/documents/{id}/
PATCH  /api/v1/oneview/documents/{id}/
DELETE /api/v1/oneview/documents/{id}/
```

### Document Positions

```
GET /api/v1/oneview/documents/{id}/positions/
```

Returns position snapshots extracted from the document.

**Response**
```json
{
  "count": 12,
  "positions": [
    {
      "id": 55,
      "security_name": "Apple Inc.",
      "ticker": "AAPL",
      "isin": "US0378331005",
      "asset_type": "equity",
      "currency": "USD",
      "as_of_date": "2026-05-01",
      "quantity": "50",
      "cost_basis": "7500.00",
      "cost_basis_currency": "USD",
      "market_value": "9350.00",
      "market_value_currency": "USD",
      "account_name": "IBKR"
    }
  ]
}
```

---

## Broker Statement Upload

```
POST /api/v1/oneview/broker-statements/upload/
```

Uploads, parses, and optionally stores a broker statement. Uses `multipart/form-data`.

**Supported brokers**: Groww, Zerodha, IBKR, Vested, Fidelity, Robinhood, Kotak, CAS

**Request fields**

| Field            | Type   | Required | Default           | Notes                              |
|------------------|--------|----------|-------------------|------------------------------------|
| `file`           | file   | yes      |                   | PDF, CSV, or XLSX                  |
| `name`           | string | no       | filename          |                                    |
| `description`    | string | no       | `""`              |                                    |
| `store_data`     | bool   | no       | `true`            | Persist positions to DB            |
| `portfolio_name` | string | no       | `"Main Portfolio"` | Portfolio to store positions under |
| `use_llm_fallback` | bool | no      | `true`            | Try LLM if parser fails            |

**Success 200**
```json
{
  "status": "success",
  "document_id": "uuid",
  "broker": "zerodha",
  "statement_date": "2026-05-01",
  "client_code": "AB1234",
  "account_name": "Zerodha",
  "positions_count": 15,
  "total_invested": "500000.00",
  "total_current": "620000.00",
  "currency": "INR",
  "storage": {
    "portfolio": "Main Portfolio",
    "account": "Zerodha",
    "account_id": 3,
    "positions_created": 15,
    "positions_updated": 0,
    "listings_created": 12
  },
  "positions": [...]
}
```

**Error 400**
```json
{
  "status": "error",
  "error": "Could not detect broker format",
  "warnings": [],
  "document_id": "uuid"
}
```

---

## Market Data

### Current Prices

```
GET /api/v1/prices/
```

**Query params**: `tickers=AAPL,MSFT`, `isins=INF846K01131`

**Response**
```json
{
  "prices": {
    "AAPL": { "price": 187.5, "currency": "USD", "date": "2026-05-20" },
    "MSFT": null
  },
  "as_of_date": "2026-05-20"
}
```

### Price History

```
GET /api/v1/price-history/
```

**Query params**: `tickers=AAPL`, `isins=INF846K01131`, `from=YYYY-MM-DD`, `to=YYYY-MM-DD`

**Response**
```json
{
  "history": {
    "AAPL": { "2026-05-01": 180.5, "2026-05-02": 182.0 }
  },
  "currencies": { "AAPL": "USD" }
}
```

### Live FX Rate

```
GET /api/v1/fx-rate/?base=USD&quote=INR
```

**Response**
```json
{ "base": "USD", "quote": "INR", "rate": 83.45 }
```

### FX Rate History

```
GET /api/v1/fx-history/?pairs=USD/INR,EUR/INR&from=YYYY-MM-DD&to=YYYY-MM-DD
```

**Response**
```json
{
  "history": {
    "USD/INR": { "2026-05-01": 83.45, "2026-05-02": 83.50 }
  }
}
```

### FX Rates CRUD

```
GET    /api/v1/fx-rates/
POST   /api/v1/fx-rates/
PATCH  /api/v1/fx-rates/{id}/
DELETE /api/v1/fx-rates/{id}/
```

**GET query params**: `base`, `quote`, `from`, `to`

---

## Error Format

All errors follow this structure:

```json
{ "error": "Human-readable message." }
```

Validation errors from serializers use DRF's default format:

```json
{ "field_name": ["This field is required."] }
```

## HTTP Status Codes

| Code | Meaning                         |
|------|---------------------------------|
| 200  | OK                              |
| 201  | Created                         |
| 204  | No Content (e.g. logout/delete) |
| 207  | Multi-Status (bulk import)      |
| 400  | Bad Request / Validation error  |
| 401  | Unauthenticated                 |
| 403  | Forbidden                       |
| 404  | Not Found                       |
| 429  | Too Many Requests (OTP resend)  |
| 502  | Upstream failure (email send)   |