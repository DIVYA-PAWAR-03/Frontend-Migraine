# Frontend Deploy Notes

This repository is static frontend configured for Vercel.

- Default page is `professional_index.html`.
- API requests go to `/api/v1/*` from the same domain.
- `vercel.json` rewrites `/api/*` to `https://backend-migraine.vercel.app/api/*`.

If your backend Vercel URL is different, update `vercel.json` before deploy.
