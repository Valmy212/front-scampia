# Backend API Status For Front Split

This file tracks API status for the split frontend flow.

Status: previously missing endpoints are now available in backend v0.2.0 and integrated in frontend.

Integrated frontend capabilities:

- Connect Wallet action
- Create Vault action
- Vault Status page
- Vault list with click-to-deposit
- Investments page (vault info, user share, value, profit)

## Available APIs

1. List vaults
- Route: GET /api/v1/vaults
- Why: investments page needs list of available vaults to render clickable cards.
- Expected payload example:
  {
    "items": [
      {
        "vault_id": 12,
        "owner": "0x...",
        "owner_fee_bps": 300,
        "asset_token": "0x...",
        "total_assets": "123450000000000000000",
        "total_shares": "120000000000000000000"
      }
    ]
  }

2. Vault status details
- Route: GET /api/v1/vaults/{vault_id}
- Why: vault status page should show canonical vault info without reconstructing from multiple routes.
- Expected payload example:
  {
    "vault_id": 12,
    "owner": "0x...",
    "owner_fee_bps": 300,
    "manager_fee_bps": 200,
    "asset_token": "0x...",
    "total_assets": "123450000000000000000",
    "total_shares": "120000000000000000000",
    "created_at": "2026-04-05T12:00:00Z"
  }

3. User investments aggregate
- Route: GET /api/v1/users/{wallet_address}/investments
- Why: investments page needs direct, normalized values for user shares, value, and profit across vaults.
- Expected payload example:
  {
    "wallet_address": "0x...",
    "items": [
      {
        "vault_id": 12,
        "shares": "1000000000000000000",
        "value": "1020000000000000000",
        "profit": "20000000000000000"
      }
    ]
  }

## Already Used Existing APIs

- POST /api/v1/users/connect
- GET /api/v1/users/{wallet_address}
- GET /api/v1/vaults/balances
- GET /api/v1/vaults/{vault_id}/positions/{user_address}
- POST /api/v1/vaults/create/build
- POST /api/v1/vaults/deposit/build
- POST /api/v1/vaults/withdraw/build

## Removed TODOs

- Removed backend TODO markers for:
  - GET /v1/vaults
  - GET /v1/vaults/{vault_id}
  - GET /v1/users/{wallet_address}/investments
- Removed frontend fallback logic that assumed vault list endpoint was unavailable.
