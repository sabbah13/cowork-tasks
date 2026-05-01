import { useEffect, useState } from 'react';
import type { Config } from '../types';
import { api } from '../api';

const FALLBACK_CONFIG: Config = {
  labels: [],
  triageIntervalMinutes: 60,
  defaultBoard: 'main',
  boards: [
    {
      id: 'main',
      name: 'Main Board',
      columns: [
        { id: 'inbox', name: 'Inbox', icon: 'inbox', color: '#6b6a64' },
        { id: 'todo', name: 'To Do', icon: 'list', color: '#6a9bcc' },
        { id: 'in-progress', name: 'In Progress', icon: 'loader', color: '#d97757' },
        { id: 'blocked', name: 'Blocked', icon: 'octagon-x', color: '#c89a3f' },
        { id: 'done', name: 'Done', icon: 'check', color: '#788c5d' },
      ],
    },
  ],
};

export function useConfig(): Config {
  const [config, setConfig] = useState<Config>(FALLBACK_CONFIG);

  useEffect(() => {
    api
      .listConfig()
      .then((c) => setConfig(c ?? FALLBACK_CONFIG))
      .catch(() => setConfig(FALLBACK_CONFIG));
  }, []);

  return config;
}
