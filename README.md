# InterviewIQ

An AI voice interviewer that asks you about **InterviewIQ**.

Paste a GitHub link, and the app reads your public repositories, starts a live voice interview about them, and gives you a **score out of 10** with a summary, your strengths, and what to improve.

<!-- Add a demo video or GIF here, for example: -->
<!-- [Watch the demo](https://your-video-link) -->

## Screenshots

| Home | Interview | Result |
|---|---|---|
| ![Home](docs/home.png) | ![Interview](docs/interview.png) | ![Result](docs/result.png) |

<!-- Put your screenshots in a docs/ folder. Delete this section if you have none yet. -->

## How it works

1. You paste your GitHub profile link.
2. The backend fetches your public repos from the GitHub API and builds an interviewer prompt from them.
3. The browser connects to the Deepgram Voice Agent and the interview starts by voice. The AI asks one question at a time about your real projects and follows up on vague answers.
4. Every turn of the conversation is saved in PostgreSQL.
5. When the interview ends, the backend sends the transcript to an LLM, which returns a rating from 1 to 10, a summary, strengths, and weaknesses.
6. You see the result on a shareable result page.

## Architecture

```mermaid
sequenceDiagram
    actor U as User
    participant B as Browser (React)
    participant S as Backend (Bun + Express)
    participant G as GitHub API
    participant D as Deepgram Voice Agent
    participant L as Groq LLM
    participant P as PostgreSQL

    U->>B: Paste GitHub link
    B->>S: POST /api/v1/pre-interview
    S->>G: Get public repos
    S->>P: Save Interview (status Pre)
    S-->>B: interview id

    B->>S: POST /api/v1/interview/:id/start
    S->>P: Set status InProgress
    S-->>B: system prompt and greeting
    B->>S: GET /api/v1/deepgram-token
    S->>D: Create short-lived token
    S-->>B: temporary token

    loop Interview (max 5 minutes)
        B->>D: Microphone audio (WebSocket)
        D-->>B: AI voice and transcript events
        B->>S: POST /api/v1/interview/:id/message
        S->>P: Save Message
    end

    B->>S: POST /api/v1/interview/:id/finish
    S->>P: Read all messages
    S->>L: Score the transcript
    L-->>S: rating, summary, strengths, weaknesses
    S->>P: Save result (status Done)
    S-->>B: result
    B->>S: GET /api/v1/interview/:id
    S-->>B: result page data
```

**Design decisions**

- **The voice goes straight from the browser to Deepgram** over one WebSocket, so audio never passes through the backend. This keeps the conversation fast.
- **The Deepgram API key never reaches the browser.** The backend creates a short-lived token for each session, and the browser uses only that.
- **The system prompt is built on the server** from the candidate's repos, then handed to the browser when the interview starts.
- **The browser posts each transcript line to the backend**, which stores it. The scoring step reads the saved conversation, not anything the browser sends at the end.

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React, Bun, React Router, Tailwind CSS, shadcn/ui, Sonner |
| Backend | Bun, Express, Axios, Zod |
| Database | PostgreSQL with Prisma 7 (`@prisma/adapter-pg`) |
| Voice | Deepgram Voice Agent (`@deepgram/agents`, `@deepgram/sdk`) |
| Scoring | Groq (OpenAI-compatible API), `openai/gpt-oss-120b` |
| Data source | GitHub REST API |

## Data model

- **Interview**: `id`, `githubMetadata` (JSON list of repos), `status` (`Pre`, `InProgress`, `Done`), `score`, `summary`, `strengths`, `weaknesses`
- **Message**: `id`, `interviewId`, `message`, `type` (`User` or `Assistant`), `createdAt`

## Getting started

### Prerequisites

- [Bun](https://bun.sh)
- A PostgreSQL database (local, or a free hosted one such as Neon or Supabase)
- A [Deepgram](https://deepgram.com) account and API key
- A [Groq](https://console.groq.com) API key (free tier)
- A modern browser with a microphone (Chrome or Edge recommended)

### 1. Clone and install

```bash
git clone <your-repo-url>
cd interview
bun install
```

### 2. Set up the backend environment

Copy `apps/backend/.env.example` to `apps/backend/.env` and fill it in:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME"
DEEPGRAM_API_KEY=
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b
GITHUB_TOKEN=
```

Notes:

- `DEEPGRAM_API_KEY` must be created with the **Member** role in the Deepgram console. Keys with the default role cannot create temporary tokens, and `/deepgram-token` will fail with a 403 error.
- `GROQ_MODEL` can be any chat model your Groq key has access to. Groq changes its model list over time, so check it with
  `curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"`.
- `GITHUB_TOKEN` is optional. Without it, GitHub allows 60 requests per hour. With a token (no permissions needed for public repos), the limit is much higher.

### 3. Set up the database

```bash
cd apps/backend
bunx prisma migrate dev
bunx prisma generate
```

### 4. Point the frontend at the backend

The frontend reads the backend address from `BACKEND_URL` in `apps/frontend/src/lib/config.ts`. For local development it should be `http://localhost:3001`.

### 5. Run

In one terminal:

```bash
cd apps/backend
bun run index.ts
```

In another:

```bash
cd apps/frontend
bun dev
```

Open the address printed by the frontend (usually `http://localhost:3000`).

## API

| Method | Route | What it does |
|---|---|---|
| `POST` | `/api/v1/pre-interview` | Takes a GitHub link, fetches the repos, creates an interview, returns its `id` |
| `POST` | `/api/v1/interview/:id/start` | Builds the interviewer prompt and greeting, sets the status to `InProgress` |
| `GET` | `/api/v1/deepgram-token` | Returns a short-lived Deepgram token for the browser |
| `POST` | `/api/v1/interview/:id/message` | Saves one turn of the conversation |
| `POST` | `/api/v1/interview/:id/finish` | Scores the transcript and saves the result |
| `GET` | `/api/v1/interview/:id` | Returns an interview and its result |

## Safeguards

- Interviews stop automatically after **5 minutes**, which also limits voice usage costs.
- Leaving the interview page turns off the microphone and closes the voice connection.
- An interview cannot be scored without enough spoken answers.
- The result page handles missing, wrong, and not-yet-scored interviews instead of showing empty data.
- API keys live only in `.env`, which is git-ignored.

## Limitations and ideas for the future

- Only public repositories are used, and the prompt includes up to the 8 most recent ones.
- No user accounts yet, so anyone with a result link can open it.
- The interview does not end by itself when the AI finishes its questions. The user presses **End interview**.
- Ideas: interview history per user, difficulty levels, choosing a role or topic, a downloadable PDF report, and live captions as an option.

## Project structure

```
interview/
├── apps/
│   ├── backend/    # Bun + Express API, Prisma schema, scoring
│   └── frontend/   # React app: home form, interview, result
```

## Author

Built by **[Your name]**. [GitHub](https://github.com/your-username) · [LinkedIn](https://linkedin.com/in/your-profile)