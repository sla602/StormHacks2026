# TriBunal Council

Describe an AI task. Three Gemini agents, each guarding a different value (business, environment, tech and
ethics), vote on it and propose a win-win idea. A majority rule plus a Python "constitution" of hard rules
decides how the task runs (`FULL`, `DOWNGRADE`, `CACHE` or `BLOCK`), and a secretary agent writes a plan that
keeps the business value while cutting carbon. Watch the vote on a triangle and hear each agent in its own
ElevenLabs voice, in two themes: Terminal and Otter. Carbon figures are estimates, not measurements.

## Setup
```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env              # then add your own keys (never commit .env)
python cli_demo.py                # check the pipeline without the UI (FORCE_FALLBACK=1 for no API calls)
cd frontend && npm install
```

## Run
```bash
uvicorn server:app --reload --port 8000          # terminal 1, project root
cd frontend && npm run dev                       # terminal 2 -> http://localhost:5173
```
One server for a demo: `cd frontend && npm run build`, then `uvicorn server:app --host 0.0.0.0 --port 8000`.

## Renaming the project
- Website title: `brand` for each theme in `frontend/src/themes.js`
- Name the agents use for their council: `APP_NAME` in `.env`

## Layout
```
server.py              FastAPI: /api/config, /api/deliberate, /api/execute, /api/reset, /api/report
cli_demo.py            pipeline check without the UI
core/
  config.py            env vars, model names, voice IDs per theme
  models.py            Vote, Plan, Task, Verdict, Action
  agents.py            the three agents: prompts, Gemini votes, rule-based fallback
  council.py           parallel voting, majority tally, constitution (hard rules)
  synth.py             secretary: one win-win plan from the votes
  executor.py          carries out the verdict (full / light model, cache, block)
  calculator.py        tokens -> estimated g CO2
  ledger.py            daily budget, history, audit report
  llm.py               Gemini (google-genai) wrapper
  tts.py               ElevenLabs narration, voices and wording per theme
data/                  presets.json, presets_otter.json, cache.json
scripts/               check_models.py, list_voices.py
frontend/src/
  App.jsx              state, API calls, the ask screen and the council screen
  Council.jsx          ask window and the voting triangle
  Panels.jsx           settings, win-win plan, audio, history
  themes.js            per-theme title, pictures, emoji and all wording
  styles.css           both themes (otter picture positions at the top)
frontend/public/otters/  otter pictures
```