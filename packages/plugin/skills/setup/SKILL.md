---
description: Helps the user check or enable Cowork connectors that Cowork Tasks reads from. Use when the user asks how to connect a source, on first run, or when triage reports a missing connector.
---

# Set up sources for Cowork Tasks

Cowork Tasks does **not** run its own OAuth flows. It reads from whatever
sources the user has already authorized in Cowork's **Connectors** panel.
Your job: point them at the right place and confirm what's connected.

## Steps

1. Tell the user where to enable connectors:

   > Open **Customize -> Connectors** in the Cowork sidebar. The Cowork
   > Tasks plugin pre-declares 25+ supported connectors so they appear
   > there ready to enable. Toggle on whichever you want Cowork Tasks to
   > read from. Each one uses Cowork's standard OAuth - the same
   > authorization is shared with every other plugin.

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

   > Slack isn't connected yet. Open **Customize -> Connectors -> Slack**
   > and click Connect.

4. After the user connects something, suggest:

   > Try `/cowork-tasks:triage-now` to pull anything you've missed since
   > before the connection went live.

## Constraints

- **Never** ask the user to paste tokens or run a local OAuth helper.
- **Never** invent connector names. Use the canonical names above.
- If the user wants a source we don't pre-declare (e.g., YouTrack,
  Telegram, Discord), point them at
  https://github.com/cowork-tasks/cowork-tasks/tree/main/examples/connector-template
  and offer to help write a PR. Until that lands, they can run the
  matching local connector binary in `packages/plugin/bin/connectors/`
  outside Cowork.
