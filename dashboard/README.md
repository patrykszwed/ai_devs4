# Task Dashboard

Futuristic UI to run AI Devs task solutions. Streams live stdout/stderr.

<img width="2551" height="1226" alt="image" src="https://github.com/user-attachments/assets/dc3e7d2c-c112-441a-a08c-206d68c14f8f" />

<img width="2557" height="1232" alt="image" src="https://github.com/user-attachments/assets/1644c5e9-1669-4281-9735-cefb838ac0b5" />



## Setup

From repo root:

```bash
npm run dashboard:install
```

Ensure root `.env` has the required keys (e.g. `OPENAI_API_KEY` or `OPENROUTER_API_KEY`). For 02-findhim, `AI_DEVS_API_KEY` is also required.

## Development

Terminal 1 – API server (port 3333):

```bash
npm run dashboard:server
```

Terminal 2 – Vite dev server (port 5173, proxies `/api` to 3333):

```bash
npm run dashboard:dev
```

Open http://localhost:5173. Select a solution and click **Run** to see live output.

## Production

Build and serve from the API server:

```bash
npm run dashboard:build
npm run dashboard:start
```

Then open http://localhost:3333.
