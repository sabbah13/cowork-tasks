---
description: Walks the user through connecting Cowork Tasks to their sources (Gmail, Slack, Fathom, etc.). Use on first run, when the user says "connect <service>", "set up Cowork Tasks", or when no connectors are configured yet.
---

# First-run setup wizard

Goal: get at least one connector working in under 5 minutes.

## Steps

1. Read `~/.cowork-tasks/credentials/` to see what's already configured.
2. Show the user the catalog:

   - **Email**: Gmail, Outlook (Microsoft 365), IMAP
   - **Meetings**: Fathom, Otter, Fireflies, Granola, Read.ai, Zoom AI Companion
   - **Chat**: Slack, Microsoft Teams, Discord, Telegram
   - **Issues**: Jira, Linear, Asana, ClickUp, Notion, Monday, GitHub, GitLab, YouTrack

3. Ask which to set up first. For each one chosen:
   - For OAuth (Gmail, Outlook, Slack, Zoom): run the matching OAuth helper
     binary in `${CLAUDE_PLUGIN_ROOT}/bin/auth/<connector>.js`. It opens a
     browser, captures the token, writes
     `~/.cowork-tasks/credentials/<connector>.json` (encrypted via keytar).
   - For API key (Fathom, Otter, Fireflies, ...): tell the user where to copy
     the key from, then ask them to paste it. Write it via the same helper.
4. Once the credential is saved, the connector monitor (already running)
   picks it up on its next tick. Confirm to the user.
5. Tell the user the first triage cycle runs in <60 minutes (configurable).
   Offer `/cowork-tasks:triage-now` to flush immediately.

## Constraints

- Never paste the actual credential into chat output.
- If the user doesn't choose a connector, default to Gmail (most universal).
