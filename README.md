# lipservice
Daily Beauty Newsletter

## Setup

### Prerequisites

Install [Node.js](https://nodejs.org/) (v18+), then install project dependencies:

```bash
npm install
```

### Claude Code & MCP (Optional)

To connect Vercel or other MCP integrations, you first need the **Claude Code CLI** installed:

```bash
npm install -g @anthropic-ai/claude-code
```

Then verify it's available:

```bash
claude --version
```

Once installed, add Vercel as an MCP server:

```bash
claude mcp add --transport http vercel https://mcp.vercel.com/mcp
```

> **Note:** If you see `zsh: command not found: claude`, run the `npm install -g` step above first.

## Usage

Generate a newsletter issue:

```bash
npm run generate
```

## Environment

Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
```
