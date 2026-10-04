# 🏛️ Eco-GovernAI

Write a case describing an AI request. Three Gemini-powered agents - **Business, Eco, and Tech & Ethics** -
vote approve / reject / abstain. A majority rule plus a Python "constitution" of hard rules decides how the
request runs: `FULL`, `DOWNGRADE`, `CACHE`, or `BLOCK`. You can **see** the votes and **hear** the session
read aloud by ElevenLabs voices (one voice per agent plus a narrator).
(Carbon figures are estimated simulations, not measurements.)

## Setup
```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # then set GEMINI_API_KEY and ELEVENLABS_API_KEY
python scripts/check_models.py    # list usable Gemini models, then edit .env
python scripts/list_voices.py     # list usable ElevenLabs voices, then edit .env
python cli_demo.py                # verify the pipeline without the UI
```
- No Gemini key / flaky network: set `FORCE_FALLBACK=1` -> rule-based votes, no Gemini calls.
- No ElevenLabs key: the audio toggle is disabled and everything else still works.

## Run the website (React + FastAPI)
Development, two terminals:
```bash
uvicorn server:app --reload --port 8000          # terminal 1, project root
cd frontend && npm install && npm run dev        # terminal 2 -> http://localhost:5173
```
Vite forwards `/api/*` to port 8000, so API keys stay on the server and never reach the browser.

Demo / deploy as one server:
```bash
cd frontend && npm install && npm run build && cd ..
uvicorn server:app --host 0.0.0.0 --port 8000    # http://localhost:8000 serves site + API
```
The ledger lives in server memory: every visitor shares it and it resets when the server restarts.

### API
| Method | Path | What it does |
|---|---|---|
| GET  | /api/config     | presets, agents, model names, key status, ledger |
| POST | /api/deliberate | council votes (nothing charged yet), returns `run_id` |
| POST | /api/execute    | runs the verdict + ElevenLabs narration, charges the ledger |
| POST | /api/reset      | clears quota usage and history |
| GET  | /api/report     | audit report download (JSON) |

## Layout
```
server.py         FastAPI backend (wraps core/, serves frontend/dist)
frontend/         React (Vite) UI: case form / votes / audio / history
cli_demo.py       UI-free pipeline check
core/
  config.py       env vars, model names, voice IDs
  models.py       Vote, Action, Task, Verdict
  calculator.py   tokens -> estimated g CO2
  llm.py          Gemini (google-genai) wrapper
  agents.py       agent prompts, voting, rule-based fallback
  council.py      parallel voting, majority tally, constitution (hard rules)
  executor.py     carries out the verdict (model switch / cache / block)
  tts.py          ElevenLabs narration of a session
  ledger.py       quota, history, audit report
data/             presets.json, cache.json
scripts/          check_models.py, list_voices.py
```
