# Tax Advisor Agent Frontend

This repository contains the frontend for the Tax Advisor Agent. It is a
password-protected Next.js application that provides a chat-style tax advisor
UI with separate answer and source panels, a thinking state while the model is
working, and chat history on the left side.

Current implementation:

- <https://tax-advisor-rho.vercel.app>

> **Important:** The site password is documented in the project report file
> in canvas submission. This README will not reveal the password.

## What This Frontend Does

- Provides the main user interface for the tax agent.
- Shows a password gate before users can access the agent.
- Sends user questions to a backend FastAPI service.
- Displays the model response in an `Answer` panel and supporting material in a
  separate `Source` panel.
- Shows `Thinking` while the backend is processing a request.
- Shows `Force proceed` option only when the model asks for additional user
  information.
- Checks backend availability through the backend `GET /health` endpoint.

## Backend Connection

This frontend is connected to a Google Colab-based backend through:

- FastAPI
- Cloudflare Tunnel

At runtime, the frontend proxies requests to the backend:

- `GET /health`
- `POST /chat`

The Next.js app exposes these through its own API route:

- `GET /api/tax-advisor`
- `POST /api/tax-advisor`

Request flow:

`Browser -> Next.js frontend -> /api/tax-advisor -> FastAPI backend -> Cloudflare Tunnel -> Colab runtime`

## Colab Project

Colab project link:

- <https://drive.google.com/file/d/1Lhzhj1iuIMdrthfF8re3-hzx_I8GUSnu/view?usp=sharing>
- Notebook in this repo: [tax-advisor-notebook.ipynb](./tax-advisor-notebook.ipynb)
- PDF report in this repo: [tax-advisor-notebook.pdf](./tax-advisor-notebook.pdf)

Colab-side environment requirements:

- `HUGGINGFACEHUB_API_TOKEN`
- `CLOUDFLARE_TOKEN`

Backend structure in the notebook:

- Loads the tax document corpus and source metadata from the project data repo.
- Chunks source text into retrieval-sized passages.
- Builds embeddings with `BAAI/bge-base-en-v1.5`.
- Stores vectors in Milvus Lite for local vector search inside Colab.
- Uses a cross-encoder reranker, `cross-encoder/ms-marco-MiniLM-L-6-v2`, to
  improve retrieval quality after the first search pass.
- Uses `openai/gpt-oss-20b` as the generation model for the final tax answer.
- Produces structured backend outputs in three modes:
  - `final` for a direct answer
  - `missing` when required taxpayer facts are missing
  - `scenario` when `force_proceed` is enabled and the system should return
    assumption-based outcomes
- Renders the result into one answer string with an `Answer` section and a
  `Sources` section, which the frontend then splits into separate UI boxes.
- Serves the Colab backend with FastAPI using:
  - `GET /health`
  - `POST /chat`
- Exposes the FastAPI server to the deployed frontend through Cloudflare
  Tunnel.


## Environment Variables

To run this project, create a local `.env` file and set:

```env
SITE_PASSWORD=your-site-password
TAX_ADVISOR_API_URL=https://your-backend-url
```

Notes:

- `SITE_PASSWORD` is the frontend access password.
- `TAX_ADVISOR_API_URL` should point to the FastAPI backend base URL.

## Password Protection

- The landing page at `/` is protected by `SITE_PASSWORD`.
- After a correct password is entered, the app sets an `HttpOnly` access cookie.
- The main UI at `/admin` and the proxy route at `/api/tax-advisor` both require
  that cookie.

## Message and Session Structure

The frontend stores chats in a session-based structure.

### Session shape

```ts
type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
};
```

### User message

```ts
type UserMessage = {
  id: string;
  role: "user";
  content: string;
};
```

### Assistant message states

```ts
type AssistantThinkingMessage = {
  id: string;
  role: "assistant";
  status: "thinking";
  question: string;
  forceProceed: boolean;
};

type AssistantReadyMessage = {
  id: string;
  role: "assistant";
  status: "ready";
  question: string;
  forceProceed: boolean;
  raw: string;
  parsed: {
    answerLines: string[];
    sourceLines: string[];
    requestsMoreInfo: boolean;
  };
};

type AssistantErrorMessage = {
  id: string;
  role: "assistant";
  status: "error";
  question: string;
  forceProceed: boolean;
  error: string;
};
```

The UI uses these states as follows:

- `thinking`: shows the `Thinking` indicator.
- `ready`: shows the parsed answer and source boxes.
- `error`: shows a short error message instead of model output.

## API Request and Response Structure

### Frontend request to Next.js proxy

The browser sends:

```json
{
  "question": "Can I deduct IRA contributions if I have a workplace retirement plan?",
  "topK": 10,
  "forceProceed": false
}
```

### Next.js proxy request to FastAPI backend

The proxy rewrites the payload to the backend format:

```json
{
  "question": "Can I deduct IRA contributions if I have a workplace retirement plan?",
  "top_k": 10,
  "force_proceed": false
}
```

### Health response

The backend health check is expected to return:

```json
{
  "ok": true
}
```

The frontend proxy then normalizes that into:

```json
{
  "ok": true,
  "healthy": true
}
```

### Chat response

The backend chat endpoint is expected to return:

```json
{
  "answer": "Answer:\n...\n\nSources:\n1. ...\n2. ..."
}
```

If the backend returns an error, the proxy also supports:

```json
{
  "detail": "..."
}
```

or

```json
{
  "error": "..."
}
```

## Answer Parsing Rules

The frontend expects the backend `answer` field to be a single string.

It parses that string by splitting on the `Sources:` section:

```text
Answer:
Tax explanation here.

Sources:
1. https://...
2. IRS Publication ...
```

Parsing behavior:

- Everything before `Sources:` is treated as answer content.
- Everything after `Sources:` is treated as source content.
- Answer lines are rendered in the `Answer` box.
- Source lines are rendered in the `Source` box.
- If no source section exists, the UI shows `No source output was returned.`

## Missing Information Flow

The frontend marks a response as needing more user input when the answer text
contains any of these patterns:

- `[MISSING_INFO]`
- `missing fields:`
- `insufficient information to determine eligibility`

When that happens:

- the model output is still shown
- the answer is not hidden
- the latest assistant message gets a `Force proceed` button
- clicking `Force proceed` resubmits the same question with
  `forceProceed: true`

## Chat Context Behavior

- Chat history is stored as client-side session state.
- The left rail shows existing chat sessions.
- The session title is derived from the first user message.
- Long titles are truncated in the history rail.
- When a user continues a chat, earlier user prompts are bundled into context
  and sent along with the latest question.
- Random starter questions are shown when a chat is empty.

## Local Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

## Stack

- Next.js 16
- React 19
- TypeScript
- FastAPI backend integration
- Cloudflare Tunnel for Colab exposure
