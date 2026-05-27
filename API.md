# Wealth Frontend API

This document covers the JSON APIs exposed by `wealth_core` and `wealth_oneview` for frontend integration.

## Base URLs

- Auth: `/api/wealth/auth/`
- Wealth core: `/api/wealth/`
- OneView uploads and documents: `/api/wealth/oneview/`

## Auth

All non-auth endpoints require DRF token auth:

```http
Authorization: Token <token>
```

### `POST /api/wealth/auth/signup/`

Starts signup and sends OTP email.

Request:

```json
{
  "name": "Lakshay Sharma",
  "email": "lakshay@example.com",
  "password": "secret123",
  "confirm_password": "secret123",
  "phone": "+6599999999"
}
```

Success:

```json
{
  "message": "OTP sent to lakshay@example.com",
  "email": "lakshay@example.com"
}
```

### `POST /api/wealth/auth/signup/verify/`

Verifies OTP and returns auth token.

Request:

```json
{
  "email": "lakshay@example.com",
  "otp": "123456"
}
```

Success:

```json
{
  "token": "auth_token",
  "user": {
    "id": 12,
    "email": "lakshay@example.com",
    "display_name": "Lakshay Sharma"
  }
}
```

### `POST /api/wealth/auth/signup/resend-otp/`

Request:

```json
{
  "email": "lakshay@example.com"
}
```

### `POST /api/wealth/auth/login/`

Request:

```json
{
  "email": "lakshay@example.com",
  "password": "secret123"
}
```

Success:

```json
{
  "token": "auth_token",
  "user": {
    "id": 12,
    "email": "lakshay@example.com",
    "display_name": "Lakshay Sharma"
  }
}
```

### `POST /api/wealth/auth/logout/`

Deletes the current token. Returns `204 No Content`.

## Client Profile

### `GET /api/wealth/me/`

Returns current wealth client profile.

Response fields:

- `id`
- `username`
- `email`
- `display_name`
- `base_currency`
- `timezone`
- `is_active`
- `created_at`
- `updated_at`

### `PATCH /api/wealth/me/`

Patchable fields:

- `display_name`
- `base_currency`
- `timezone`
- `is_active`

## Portfolios

### `GET /api/wealth/portfolios/`
### `POST /api/wealth/portfolios/`
### `GET /api/wealth/portfolios/{id}/`
### `PATCH /api/wealth/portfolios/{id}/`
### `DELETE /api/wealth/portfolios/{id}/`

Portfolio fields:

- `id`
- `name`
- `base_currency`
- `base_currency_code`
- `primary_fx_provider`
- `created_at`
- `updated_at`

### `POST /api/wealth/portfolios/{id}/materialize/`

Queues recompute for all active accounts in the portfolio.

Response:

```json
{
  "queued": true,
  "account_count": 2,
  "account_ids": [4, 5],
  "task_ids": []
}
```

### `GET /api/wealth/portfolios/{id}/valuation/?date=YYYY-MM-DD&currency=USD`

Returns portfolio-level aggregated valuation.

Response:

- `portfolio_id`
- `portfolio_name`
- `currency`
- `accounts`
- `market_value`
- `cost_basis`
- `gain_amount`
- `gain_pct`

## Accounts

Nested under portfolio.

### `GET /api/wealth/portfolios/{portfolio_id}/accounts/`
### `POST /api/wealth/portfolios/{portfolio_id}/accounts/`
### `GET /api/wealth/portfolios/{portfolio_id}/accounts/{id}/`
### `PATCH /api/wealth/portfolios/{portfolio_id}/accounts/{id}/`
### `DELETE /api/wealth/portfolios/{portfolio_id}/accounts/{id}/`

Account fields:

- `id`
- `portfolio`
- `name`
- `account_type`
- `base_currency`
- `valuation_mode`
- `institution_name`
- `external_account_id`
- `is_active`
- `is_hidden`
- `created_at`
- `updated_at`

Delete behavior:

- default: soft delete via `is_active=false`
- hard delete: `?hard=true`

### `GET /api/wealth/portfolios/{portfolio_id}/accounts/{id}/valuation/?from=YYYY-MM-DD&to=YYYY-MM-DD`

Returns `DailyValuation[]`.

Each row includes:

- `valuation_date`
- `holdings_cost_basis`
- `holdings_market_value`
- `cash_balance`
- `total_cost_basis`
- `total_market_value`
- `day_gain_amount`
- `day_gain_pct`
- `total_gain_amount`
- `total_gain_pct`
- `daily_twr`
- `cumulative_twr`
- `ytd_twr`
- `currency`
- `is_estimated`
- `computed_at`

### `GET /api/wealth/portfolios/{portfolio_id}/accounts/{id}/holdings/?date=YYYY-MM-DD`

Returns the latest `HoldingSnapshot` on or before the target date.

Response includes:

- `snapshot_date`
- `positions_json`
- `cash_balances_json`
- `total_cost_basis`
- `total_cash`
- `net_contribution`
- `book_value`
- `computed_at`

### `GET /api/wealth/portfolios/{portfolio_id}/accounts/{id}/performance/?from=YYYY-MM-DD&to=YYYY-MM-DD`

Response:

```json
{
  "account_id": 7,
  "from_date": "2026-04-01",
  "to_date": "2026-05-22",
  "cumulative_twr": "0.0832",
  "ytd_twr": "0.1121",
  "daily_series": [
    {
      "valuation_date": "2026-05-21",
      "daily_twr": "0.0012",
      "cumulative_twr": "0.0832",
      "ytd_twr": "0.1121"
    }
  ]
}
```

## Portfolio Listings

Nested under portfolio.

### `GET /api/wealth/portfolios/{portfolio_id}/portfolio-listings/`
### `POST /api/wealth/portfolios/{portfolio_id}/portfolio-listings/`
### `GET /api/wealth/portfolios/{portfolio_id}/portfolio-listings/{id}/`
### `PATCH /api/wealth/portfolios/{portfolio_id}/portfolio-listings/{id}/`
### `DELETE /api/wealth/portfolios/{portfolio_id}/portfolio-listings/{id}/`

List filters:

- `type=<listing_type>`
- `active=true`

Portfolio listing fields:

- `id`
- `ticker_symbol`
- `isin`
- `venue`
- `currency`
- `security_name`
- `type`
- `price_quote_multiplier`
- `valuation_method`
- `primary_price_provider`
- `attributes_json`
- `is_active`
- `created_at`
- `updated_at`

### `GET /api/wealth/portfolios/{portfolio_id}/portfolio-listings/{id}/prices/?from=YYYY-MM-DD&to=YYYY-MM-DD&provider=marketdata`

Returns `QuotePrice[]`.

Fields:

- `id`
- `portfolio_listing`
- `quote_date`
- `close_price`
- `currency`
- `provider`
- `is_estimated`

### `POST /api/wealth/portfolios/{portfolio_id}/portfolio-listings/{id}/prices/`

Creates a manual price row.

Request:

```json
{
  "quote_date": "2026-05-22",
  "close_price": "123.45",
  "currency": "USD",
  "provider": "manual",
  "is_estimated": false
}
```

### `DELETE /api/wealth/portfolios/{portfolio_id}/portfolio-listings/{id}/prices/{price_id}/`

Deletes one price row.

## Categories

### `GET /api/wealth/portfolios/{portfolio_id}/categories/`
### `POST /api/wealth/portfolios/{portfolio_id}/categories/`
### `GET /api/wealth/portfolios/{portfolio_id}/categories/{id}/`
### `PATCH /api/wealth/portfolios/{portfolio_id}/categories/{id}/`
### `DELETE /api/wealth/portfolios/{portfolio_id}/categories/{id}/`

Response is tree-shaped from root categories.

Fields:

- `id`
- `name`
- `parent`
- `target_weight`
- `children`

## Activities

### `GET /api/wealth/portfolios/{portfolio_id}/activities/`
### `POST /api/wealth/portfolios/{portfolio_id}/activities/`
### `GET /api/wealth/portfolios/{portfolio_id}/activities/{id}/`
### `PATCH /api/wealth/portfolios/{portfolio_id}/activities/{id}/`
### `DELETE /api/wealth/portfolios/{portfolio_id}/activities/{id}/`

List filters:

- `account=<account_id>`
- `portfolio_listing=<listing_id>`
- `type=<activity_type_code>`
- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`
- `is_draft=true|false`
- `ordering=-activity_date`

Activity fields:

- `id`
- `account`
- `portfolio_listing`
- `activity_type`
- `activity_type_code`
- `activity_date`
- `settlement_date`
- `quantity`
- `price_per_unit`
- `gross_amount`
- `commission`
- `fees`
- `taxes_withheld`
- `net_amount`
- `amount`
- `currency`
- `fx_rate_to_account`
- `split_ratio`
- `related_activity`
- `activity_group`
- `external_id`
- `source_type`
- `notes`
- `tags_json`
- `is_draft`
- `is_confirmed`
- `created_at`
- `updated_at`

Delete behavior:

- draft: hard delete
- confirmed: archive via `is_confirmed=false`

### `POST /api/wealth/portfolios/{portfolio_id}/activities/bulk/`

Request:

```json
{
  "activities": [
    {
      "account": 4,
      "portfolio_listing": 10,
      "activity_type": 2,
      "activity_date": "2026-05-20",
      "quantity": "10",
      "price_per_unit": "100",
      "gross_amount": "1000",
      "currency": "USD"
    }
  ]
}
```

Response:

```json
{
  "created": 1,
  "skipped": 0,
  "errors": []
}
```

## Position Snapshots

Nested under account.

### `GET /api/wealth/portfolios/{portfolio_id}/accounts/{account_id}/snapshots/`

Behavior:

- with `?date=YYYY-MM-DD`: exact date
- without `date`: latest `as_of_date`
- optional `portfolio_listing=<listing_id>`

### `POST /api/wealth/portfolios/{portfolio_id}/accounts/{account_id}/snapshots/`
### `DELETE /api/wealth/portfolios/{portfolio_id}/accounts/{account_id}/snapshots/{id}/`

Snapshot fields:

- `id`
- `portfolio_listing`
- `as_of_date`
- `quantity`
- `cost_basis_amount`
- `cost_basis_currency`
- `market_value_amount`
- `market_value_currency`
- `source_type`
- `external_id`
- `created_at`

### `POST /api/wealth/portfolios/{portfolio_id}/accounts/{account_id}/snapshots/import/`

Request:

```json
{
  "as_of_date": "2026-05-22",
  "positions": [
    {
      "portfolio_listing_id": 10,
      "quantity": "15.5",
      "cost_basis_amount": "1200",
      "cost_basis_currency": "USD",
      "market_value_amount": "1400",
      "market_value_currency": "USD"
    }
  ]
}
```

Response:

```json
{
  "created": 1,
  "updated": 0
}
```

## Valuation Overrides

### `GET /api/wealth/portfolios/{portfolio_id}/overrides/`
### `POST /api/wealth/portfolios/{portfolio_id}/overrides/`
### `GET /api/wealth/portfolios/{portfolio_id}/overrides/{id}/`
### `PATCH /api/wealth/portfolios/{portfolio_id}/overrides/{id}/`
### `DELETE /api/wealth/portfolios/{portfolio_id}/overrides/{id}/`

Filters:

- `portfolio_listing=<listing_id>`
- `account=<account_id>`
- `date=YYYY-MM-DD`

Fields:

- `id`
- `account`
- `portfolio_listing`
- `as_of_date`
- `market_value_amount`
- `currency`
- `notes`
- `source_type`

## FX APIs

### `GET /api/wealth/fx-rates/`
### `POST /api/wealth/fx-rates/`
### `PATCH /api/wealth/fx-rates/{id}/`
### `DELETE /api/wealth/fx-rates/{id}/`

Filters:

- `base=USD`
- `quote=INR`
- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`

Fields:

- `id`
- `base_currency`
- `quote_currency`
- `quote_date`
- `rate`
- `inverse_rate`
- `provider`
- `is_estimated`

### `GET /api/wealth/fx-rate/?base=USD&quote=INR`

Returns a live/current FX rate if available.

Response:

```json
{
  "base": "USD",
  "quote": "INR",
  "rate": 85.1234
}
```

### `GET /api/wealth/fx-history/?pairs=USD/INR,EUR/INR&from=YYYY-MM-DD&to=YYYY-MM-DD`

Response:

```json
{
  "history": {
    "USD/INR": {
      "2026-05-20": 85.1234,
      "2026-05-21": 85.4411
    }
  }
}
```

## Price Lookup APIs

### `GET /api/wealth/prices/?tickers=AAPL,MSFT&isins=US0378331005`

Returns latest available price by ticker and/or ISIN.

Response:

```json
{
  "prices": {
    "AAPL": {
      "price": 210.12,
      "currency": "USD",
      "date": "2026-05-21"
    },
    "US0378331005": null
  },
  "as_of_date": "2026-05-21"
}
```

### `GET /api/wealth/price-history/?tickers=AAPL,MSFT&isins=US0378331005&from=YYYY-MM-DD&to=YYYY-MM-DD`

Response:

```json
{
  "history": {
    "AAPL": {
      "2026-05-20": 208.11,
      "2026-05-21": 210.12
    }
  },
  "currencies": {
    "AAPL": "USD"
  }
}
```

## Derived Valuation APIs

### `GET /api/wealth/net-worth/?date=YYYY-MM-DD&currency=USD`

Returns client-wide aggregated net worth.

Top-level fields:

- `as_of_date`
- `currency`
- `total_market_value`
- `total_cost_basis`
- `total_cash`
- `total_gain_amount`
- `total_gain_pct`
- `portfolios`

### `GET /api/wealth/valuations/?accounts=1,2,3&date=YYYY-MM-DD&currency=USD`

Returns aggregated valuation across a selected account set.

### `POST /api/wealth/materialize/`

Request:

```json
{
  "portfolio_ids": [1, 2],
  "account_ids": [3, 4]
}
```

Both keys are optional. If omitted, all active client accounts are selected.

Response:

```json
{
  "queued": true,
  "account_count": 2,
  "account_ids": [3, 4],
  "task_ids": []
}
```

## OneView Documents

### `GET /api/wealth/oneview/documents/`
### `POST /api/wealth/oneview/documents/`
### `GET /api/wealth/oneview/documents/{id}/`
### `PATCH /api/wealth/oneview/documents/{id}/`
### `DELETE /api/wealth/oneview/documents/{id}/`

Multipart upload fields:

- `file`
- `name`
- `description`

Document fields:

- `id`
- `name`
- `description`
- `file`
- `file_url`
- `file_size`
- `content_type`
- `uploaded_by`
- `uploaded_by_username`
- `accounts`
- `positions_count`
- `created_at`
- `updated_at`

### `GET /api/wealth/oneview/documents/{id}/positions/`

Returns extracted/stored `PositionSnapshot` data tied to a document.

Response:

```json
{
  "positions": [
    {
      "id": 91,
      "security_name": "Microsoft Corp",
      "ticker": "MSFT",
      "isin": null,
      "asset_type": "equity",
      "currency": "USD",
      "as_of_date": "2026-05-21",
      "quantity": "10.0000000000",
      "cost_basis": "1000.0000000000",
      "cost_basis_currency": "USD",
      "market_value": "1200.0000000000",
      "market_value_currency": "USD",
      "account_name": "Ibkr - U18702725"
    }
  ],
  "count": 1
}
```

## OneView Broker Statement Upload

### `POST /api/wealth/oneview/broker-statements/upload/`

Uploads, parses, and optionally stores a broker statement.

Multipart request fields:

- `file` required
- `name` optional
- `description` optional
- `store_data` optional, default `true`
- `portfolio_name` optional, default `Main Portfolio`
- `use_llm_fallback` optional, default `true`

Success response:

```json
{
  "status": "success",
  "document_id": 14,
  "broker": "ibkr",
  "statement_date": "2026-05-21",
  "client_code": "U18702725",
  "account_name": "Ibkr - U18702725",
  "positions_count": 4,
  "total_invested": "10000.50",
  "total_current": "10990.75",
  "currency": "USD",
  "storage": {
    "portfolio": "Main Portfolio",
    "account": "Ibkr - U18702725",
    "account_id": 7,
    "positions_created": 4,
    "positions_updated": 0,
    "listings_created": 2
  },
  "positions": []
}
```

Error response:

```json
{
  "status": "error",
  "error": "Parse failed",
  "warnings": [],
  "document_id": 14
}
```

Notes:

- `positions` in success response is capped to 50 rows.
- if more than 50 positions are parsed, response also includes `positions_truncated=true` and `total_positions`.
- supported upload extensions are `.csv`, `.xlsx`, `.pdf`
- upload size limit is `10 MB`

## Frontend Integration Order

Typical app boot:

1. `POST /api/wealth/auth/login/`
2. `GET /api/wealth/me/`
3. `GET /api/wealth/portfolios/`
4. `GET /api/wealth/net-worth/`

Typical account detail page:

1. `GET /api/wealth/portfolios/{portfolio_id}/accounts/{id}/holdings/`
2. `GET /api/wealth/portfolios/{portfolio_id}/accounts/{id}/valuation/?from=...&to=...`
3. `GET /api/wealth/portfolios/{portfolio_id}/accounts/{id}/performance/?from=...&to=...`

Typical OneView upload flow:

1. `POST /api/wealth/oneview/broker-statements/upload/`
2. `GET /api/wealth/oneview/documents/`
3. `GET /api/wealth/oneview/documents/{id}/positions/`
