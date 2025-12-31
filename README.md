# Terun Allocation Optimizer (Frontend)

Modern Next.js + TypeScript frontend for the voting allocation optimizer. The UI validates inputs, calls the backend optimizer, and renders allocation, payouts, and metrics.

## Quick Start

1. Install dependencies:
   ```
   npm install
   ```
2. Run the dev server:
   ```
   npm run dev
   ```

## Environment (Optional)

- `BACKEND_BASE_URL`: If set, the app proxies to an external backend (`${BACKEND_BASE_URL}/api/optimize`).
- If not set, the built-in Next.js API route computes the optimization directly.

## API Contract (Frontend -> Backend)

### Endpoint
`POST /api/optimize`

### Request JSON
```json
{
  "budget": 1000,
  "candidates": [
    { "name": "Candidate A", "p": 0.5, "m": "1.8" }
  ],
  "rounding": "floor",
  "mode": "all_weather_maximin",
  "params": {}
}
```

### Response JSON
```json
{
  "status": "ok",
  "allocation": [{ "name": "Candidate A", "s": 600 }],
  "payoutByOutcome": [{ "name": "Candidate A", "payout": 1080 }],
  "metrics": { "G": 900, "EV": 1042.3, "EP": 42.3, "P_loss": 0.12 },
  "notes": ["Optional backend notes..."]
}
```

Status values: `ok`, `infeasible`, `error`.

## Modes (Enum)

- `all_weather_maximin`
- `hedge_breakeven_then_ev`
- `beast_ev_under_maxloss` (`params.maxLossPct` in range `0..1`)
- `ev_under_lossprob_cap` (`params.lossProbCap` in range `0..1`)
- `maximize_prob_ge_target` (`params.targetT` integer)
- `sparse_k_focus` (`params.kSparse` integer)

## Input Rules

- **Budget**: integer > 0.
- **Probability**: enter percentages (e.g., `50` for 50%). The UI shows total sum and can auto-normalize.
- **Multiplier**: positive decimal. Sent as a string to preserve exact input for backend rational parsing.
- **Rounding**: always `"floor"` (fixed).
- If probabilities do not sum to 100%, the backend will use them as-is and may return a warning note.

## Share Links

Use **Share Link** to encode the current inputs into the query string so teammates can open the same state.

## Backend Prompt

See `BACKEND_PROMPT.md` for the backend agent instructions.
