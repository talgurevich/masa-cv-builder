# pdf-worker

Tiny Flask service that renders a CV JSON into a Hebrew RTL PDF using
headless Chromium. Wraps `generate_pdf.py` (kept in sync with the upstream
[cv-skill](https://github.com/talgurevich/cv-skill) repo).

## Endpoints

- `GET /healthz` — liveness check (no auth)
- `POST /render` — render a PDF (`Authorization: Bearer <RENDER_SHARED_SECRET>`).
  Body: CV JSON matching `cv_schema`. Response: `application/pdf`.

## Local dev

```bash
cd pdf-worker
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
RENDER_SHARED_SECRET=dev CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  python3 app.py
```

Then in another terminal:

```bash
curl -X POST http://localhost:8080/render \
  -H 'Authorization: Bearer dev' \
  -H 'Content-Type: application/json' \
  -d @../examples/sample_cv.json \
  -o /tmp/cv.pdf
open /tmp/cv.pdf
```

## Deploy to Fly.io

```bash
cd pdf-worker
fly auth login                          # once
fly launch --no-deploy                  # creates app + reads fly.toml
fly secrets set RENDER_SHARED_SECRET=$(openssl rand -hex 32)
fly deploy
fly status                              # note the *.fly.dev URL
```

Then in your Vercel project, set:

- `PDF_WORKER_URL` → `https://<app>.fly.dev`
- `RENDER_SHARED_SECRET` → same secret you set on Fly
