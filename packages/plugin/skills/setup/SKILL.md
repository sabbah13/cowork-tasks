---
name: setup
description: Helps the user check or enable the connectors that Cowork Tasks reads from. Use when the user asks how to connect a source, on first run, or when triage reports a missing connector.
---

# Set up sources for Cowork Tasks

Cowork Tasks does **not** run its own OAuth flows. It reads from whatever
connectors the user has already added and connected in Claude. Your job:
point them at the right place and confirm what's connected.

## Steps

1. Tell the user where to enable connectors:

   > Open **Customize > Plugins**, select **Cowork Tasks**, and open its
   > **Connectors** tab. It lists the 26 connectors the plugin can read
   > from. For each one you want, add it if it shows **Not added**, then
   > connect it if it shows **Not connected**. Installing the plugin does
   > not connect anything by itself. Connectors you add also appear under
   > **Customize > Connectors**, and the same sign-in is shared with every
   > other plugin on your account.

2. List the supported connectors grouped by category. Pull from
   `${CLAUDE_PLUGIN_ROOT}/CONNECTORS.md` if you need a refresh, but the
   short version is:

   - **Email / calendar / Office:** Gmail, Google Calendar, Microsoft 365
   - **Chat:** Slack
   - **Issue trackers:** Atlassian (Jira), Linear, Asana, monday.com,
     ClickUp, GitHub
   - **Knowledge:** Notion, Guru
   - **Meeting recorders:** Fathom, Fireflies, Granola, Gong
   - **Customer support:** Intercom
   - **CRM:** HubSpot, Close
   - **Incidents / on-call:** PagerDuty, Datadog
   - **Files:** Box, Egnyte
   - **Signatures:** DocuSign
   - **Design:** Figma, Canva

3. If a specific connector failed during a triage run, name it and link
   the user to the right place:

   > Slack isn't connected yet. Open **Customize > Connectors**, find
   > **Slack**, and select Connect.

4. After the user connects something, suggest:

   > Try `/cowork-tasks:triage-now` to pull anything you've missed since
   > before the connection went live.

## Constraints

- **Never** ask the user to paste tokens or run a local OAuth helper.
- **Never** invent connector names. Use the canonical names above.
- **Never** suggest writing a custom connector package, polling daemon,
  or local OAuth helper. Cowork Tasks only reads from MCP connectors
  that Claude already hosts - that's the architecture, not a temporary
  state.
- If the user wants a source there is no connector for yet (e.g.
  YouTrack, Telegram, Discord), tell them honestly: source coverage is
  upstream. They should request the connector from Anthropic. We add a
  one-line entry to `.mcp.json` once it's available.
