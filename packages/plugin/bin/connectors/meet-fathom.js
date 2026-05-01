#!/usr/bin/env node
import { createFathomConnector } from '@cowork-tasks/connector-meet-fathom';
import { startConnector } from './_runner.mjs';

await startConnector({
  requiredEnvVars: ['FATHOM_API_KEY'],
  make: () =>
    createFathomConnector({
      apiKey: process.env.FATHOM_API_KEY,
    }),
});
