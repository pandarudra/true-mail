# TrueMail MCP Server

A self-hosted [Model Context Protocol](https://modelcontextprotocol.io/) server for TrueMail, using **Streamable HTTP transport** (stateless, one transport per POST).

## Setup

```bash
cd mcp
cp .env.example .env   # edit secrets if needed
npm install
npm run dev            # http://localhost:3001
```

## Environment

| Variable | Purpose |
|---|---|
| `TRUEMAIL_API_URL` | Base URL of the TrueMail Next.js app |
| `INTERNAL_API_KEY` | Shared secret for MCP→TrueMail API calls (must match `web/.env`) |
| `MCP_SHARED_SECRET` | Shared secret for agent→MCP calls (must match `web/.env`) |
| `MCP_PORT` | Port to listen on (default 3001) |

## Tools

| Tool | Description |
|---|---|
| `search_emails` | Full-text search across all mailboxes |
| `get_email` | Fetch a single email by ID |
| `summarize_email` | AI summary of an email |
| `extract_actions` | Extract action items from an email |
| `search_tasks` | Query the user's task list |
| `create_task` | Create a task (with optional source email) |
| `send_email` | Send a new email (requires `confirmed:true`) |
| `reply_email` | Reply to an email (requires `confirmed:true`) |

## Transport

`POST /mcp` — stateless Streamable HTTP per the MCP spec.  
`GET /health` — liveness probe.

Each request is independently authenticated with `X-Internal-Secret` + `X-User-Id` headers injected by the TrueMail web server.
