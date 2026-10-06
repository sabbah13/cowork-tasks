import { describe, it, expect } from 'vitest';
import {
  artifactToolCalls,
  checkAllowlists,
  extractAllowlists,
  serverToolNames,
} from '../validate-skills-lib.mjs';

const SERVER_TOOLS = new Set(['list_tasks', 'move_task', 'restore_task', 'rename_label']);
const P = 'mcp__cowork-tasks__';

describe('extractAllowlists', () => {
  it('finds every mcp_tools block in a markdown file', () => {
    const md = [
      '```',
      `{ "mcp_tools": ["${P}list_tasks", "${P}move_task"] }`,
      '```',
      '```',
      `{ "mcp_tools": [ "${P}list_tasks" ] }`,
      '```',
    ].join('\n');
    expect(extractAllowlists(md)).toEqual([
      [`${P}list_tasks`, `${P}move_task`],
      [`${P}list_tasks`],
    ]);
  });
});

describe('serverToolNames', () => {
  it('reads tool names from the TOOLS array', () => {
    const src = "const TOOLS = [\n  {\n    name: 'list_tasks',\n  },\n  {\n    name: 'restore_task',\n  },\n];";
    expect([...serverToolNames(src)]).toEqual(['list_tasks', 'restore_task']);
  });

  it('ignores deeper-indented name keys (e.g. inside inputSchema)', () => {
    const src = "  {\n    name: 'a_tool',\n    inputSchema: { properties: {\n        name: 'nope',\n    } },\n  },";
    expect([...serverToolNames(src)]).toEqual(['a_tool']);
  });
});

describe('artifactToolCalls', () => {
  it('finds plain and generic callMcp calls', () => {
    const src = [
      "await callMcp<ListTasksResult>('list_tasks', args);",
      "safe(callMcp<{ ok: boolean; task?: Task }>('restore_task', { id }));",
      "callMcp('move_task', {});",
    ].join('\n');
    expect([...artifactToolCalls(src)].sort()).toEqual(['list_tasks', 'move_task', 'restore_task']);
  });
});

describe('checkAllowlists', () => {
  const base = { label: 'skills/open-board/SKILL.md', serverTools: SERVER_TOOLS };

  it('passes when calls are a subset of the allowlist and the allowlist a subset of the server', () => {
    const problems = checkAllowlists({
      ...base,
      artifactCalls: new Set(['list_tasks', 'restore_task']),
      allowlists: [[`${P}list_tasks`, `${P}restore_task`, `${P}rename_label`]],
    });
    expect(problems).toEqual([]);
  });

  it('REGRESSION 0.4.14: flags a tool the artifact calls but the allowlist omits', () => {
    const problems = checkAllowlists({
      ...base,
      artifactCalls: new Set(['list_tasks', 'restore_task']),
      allowlists: [[`${P}list_tasks`, `${P}move_task`]],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/calls restore_task but the allowlist omits it/);
  });

  it('flags an allowlisted tool the server no longer exposes', () => {
    const problems = checkAllowlists({
      ...base,
      artifactCalls: new Set(['list_tasks']),
      allowlists: [[`${P}list_tasks`, `${P}ghost_tool`]],
    });
    expect(problems.join('\n')).toMatch(/ghost_tool.*not a tool the cowork-tasks MCP server exposes/);
  });

  it('flags wrong wire format (REGRESSION 0.4.8: server:tool)', () => {
    const problems = checkAllowlists({
      ...base,
      artifactCalls: new Set(),
      allowlists: [['cowork-tasks:list_tasks']],
    });
    expect(problems.join('\n')).toMatch(/must match mcp__<server>__<tool>/);
  });

  it('flags an empty allowlist', () => {
    const problems = checkAllowlists({ ...base, artifactCalls: new Set(), allowlists: [[]] });
    expect(problems.join('\n')).toMatch(/empty mcp_tools allowlist/);
  });

  it('flags update and create blocks that grant different tools', () => {
    const problems = checkAllowlists({
      ...base,
      artifactCalls: new Set(['list_tasks']),
      allowlists: [
        [`${P}list_tasks`, `${P}move_task`],
        [`${P}list_tasks`],
      ],
    });
    expect(problems.join('\n')).toMatch(/blocks differ from each other/);
  });

  it('does not judge another server\'s tools', () => {
    const problems = checkAllowlists({
      ...base,
      artifactCalls: new Set(['list_tasks']),
      allowlists: [[`${P}list_tasks`, 'mcp__gmail__search_threads']],
    });
    expect(problems).toEqual([]);
  });
});
