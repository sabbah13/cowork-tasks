#!/usr/bin/env node
import { createSlackConnector } from '@cowork-tasks/connector-chat-slack';
import { startConnector } from './_runner.mjs';

await startConnector({
  requiredEnvVars: ['SLACK_USER_TOKEN'],
  make: () =>
    createSlackConnector({
      token: process.env.SLACK_USER_TOKEN,
      workspaceUrl: process.env.SLACK_WORKSPACE_URL,
    }),
});
