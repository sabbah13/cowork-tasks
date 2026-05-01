#!/usr/bin/env node
import { createGmailConnector } from '@cowork-tasks/connector-email-gmail';
import { startConnector } from './_runner.mjs';

await startConnector({
  requiredEnvVars: ['GMAIL_ACCESS_TOKEN'],
  make: () =>
    createGmailConnector({
      credentials: { accessToken: process.env.GMAIL_ACCESS_TOKEN },
    }),
});
