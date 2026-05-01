#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as os from 'node:os';
import * as path from 'node:path';
import { CoworkTasksServer } from './server.js';

const home = process.env.TASKS_HOME ?? path.join(os.homedir(), '.cowork-tasks');

async function main() {
  const server = new CoworkTasksServer({ home });
  await server.start();
  const transport = new StdioServerTransport();
  await server.rawServer.connect(transport);
  process.stderr.write(`[cowork-tasks-mcp] running, home=${home}\n`);
  const stop = () => {
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  process.stderr.write(`[cowork-tasks-mcp] fatal: ${err instanceof Error ? err.stack : err}\n`);
  process.exit(1);
});
