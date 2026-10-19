# Isolated feature preview

The feature branch is configured for a Vercel Preview deployment and a separate Render API service. Keep both on preview settings; do not point them at the production API or production database.

## Render API

1. In Render, create a Blueprint using `render.preview.yaml` from this branch.
2. Set `DATABASE_URL` to a **separate staging database**. Do not reuse the production database URL.
3. Add staging `GROQ_API_KEY` and `HF_TOKEN` values. The API can start without these keys, but AI answers and semantic search will be limited.
4. Wait for `/` to return `{"status":"online", ...}` and copy the new service URL.

The Blueprint uses Render's free web-service plan. It does not create or select a database, because free Render PostgreSQL databases expire after 30 days and client intake data should not be placed in a short-lived or production database without an explicit choice.

## Vercel frontend

1. Ensure the GitHub repository is connected to the existing Vercel project and that this branch is treated as a Preview branch.
2. In Vercel project settings, set `VITE_API_BASE_URL` for the **Preview** environment to the separate Render API URL (for example, `https://nyayamitra-preview-api.onrender.com`).
3. Trigger a new Preview deployment for this branch. Vercel assigns its own generated preview URL; production settings and the production domain remain attached to `main`.

The intake link accepts a single submission, expires after 30 days, and stores responses in the configured database. Use staging credentials and test data only.
