# Valtoris Financial Site

Editable development project for Vite + React + TypeScript.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy to Vercel

- Import the project in Vercel
- Add environment variable: `GOOGLE_SHEETS_WEBHOOK_URL`
- Deploy

## Included

- `src/` app entry and styles
- `components/` reusable UI pieces
- `pages/` route pages
- `api/lead.ts` Vercel serverless lead endpoint
- `server/leadServerExample.ts` optional Express example
- `google-apps-script/Code.gs` Google Sheets webhook script
- `.env.example` sample environment variables
