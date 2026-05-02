# Cowork Tasks - sources

Cowork Tasks reads from whatever Cowork connectors you have authorized. The
plugin declares all of these in `.mcp.json` so they appear in your
Connectors panel ready to enable. Triage uses only the ones you turn on.

| Category | Connectors |
|---|---|
| Email | Gmail, Microsoft 365 (Outlook) |
| Calendar | Google Calendar, Microsoft 365 |
| Chat | Slack, Microsoft Teams (via MS365) |
| Issue / project trackers | Atlassian (Jira), Linear, Asana, monday.com, ClickUp, GitHub |
| Knowledge bases | Notion, Guru |
| Meeting recorders | Fathom, Fireflies, Granola, Gong |
| Customer support | Intercom |
| CRM | HubSpot, Close |
| Incidents / on-call | PagerDuty, Datadog |
| File storage | Box, Egnyte |
| Signatures | DocuSign |
| Design | Figma, Canva |

## Triage policies per category

- **Email** → tasks for first incoming messages with explicit asks. Skip newsletters and replies in own threads.
- **Calendar** → tasks for upcoming events with prep instructions ("Bring slides", "Review deck before...").
- **Chat** → tasks only for DMs and `@me` mentions that contain a question or request.
- **Issues** → tasks for new assignments, status->blocked on user's items, or due-soon shifts.
- **Meetings** → tasks for attributed action items ("Alex will...") and follow-up commitments. Use the recorder's deep link with timestamp when possible.
- **Customer support** → tasks for tickets newly assigned to user or escalated.
- **CRM** → tasks for next-step reminders, stale opportunities, or follow-ups recorded by the user.
- **Incidents** → tasks for incidents the user is on-call for, or new alerts on services they own.
- **Files / signatures** → tasks for shared docs requiring review or pending signatures.
- **Design** → tasks for review requests or comment threads addressed to user.

If a connector isn't on the list and the user wants it, the project's
`examples/connector-template/` shows how to add one in ~50 lines of
TypeScript - it ships as a separate `connector-*` package and gets
referenced via a hosted MCP URL when published.
