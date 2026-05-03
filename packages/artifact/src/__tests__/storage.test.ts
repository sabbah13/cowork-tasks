import { describe, it, expect, beforeEach } from 'vitest';
import { storage, mergeWithCache } from '../storage';
import type { Task } from '../types';

const NOW = '2026-05-02T20:00:00Z';
const LATER = '2026-05-02T21:00:00Z';

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    description: '',
    status: 'active',
    column: 'inbox',
    position: 0,
    priority: 'none',
    labels: [],
    source: { type: 'manual' },
    links: [],
    checklist: [],
    comments: [],
    created: NOW,
    updated: NOW,
    ...overrides,
  };
}

class MemoryLocalStorage {
  private store = new Map<string, string>();
  getItem(k: string) {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, v);
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
  get length() {
    return this.store.size;
  }
  key(i: number) {
    return Array.from(this.store.keys())[i] ?? null;
  }
}

beforeEach(() => {
  (globalThis as { localStorage: MemoryLocalStorage }).localStorage = new MemoryLocalStorage();
});

describe('mergeWithCache (snapshot-tagged)', () => {
  it('drops cached ghost ids that match the dev-mock pattern', () => {
    const seed = [task('real-1')];
    const cache = {
      tasks: [task('real-1'), task('t1'), task('t7')],
      snapshotVersion: 1,
      locallyCreatedIds: new Set<string>(),
    };
    const result = mergeWithCache(seed, cache, new Set(), 2);
    expect(result.map((t) => t.id).sort()).toEqual(['real-1']);
  });

  it('keeps locally-created ids even if not in seed', () => {
    const seed = [task('seed-1')];
    const cache = {
      tasks: [task('seed-1'), task('local-abc', { title: 'fresh!' })],
      snapshotVersion: 1,
      locallyCreatedIds: new Set(['local-abc']),
    };
    const result = mergeWithCache(seed, cache, new Set(), 2);
    expect(result.map((t) => t.id).sort()).toEqual(['local-abc', 'seed-1']);
  });

  it('drops cached ids not in seed and not locally created (ghost)', () => {
    const seed = [task('seed-1')];
    const cache = {
      tasks: [task('seed-1'), task('orphan-9')],
      snapshotVersion: 1,
      locallyCreatedIds: new Set<string>(),
    };
    const result = mergeWithCache(seed, cache, new Set(), 2);
    expect(result.map((t) => t.id)).toEqual(['seed-1']);
  });

  it('keeps cache-only ids when cache is at least as fresh as seed', () => {
    const seed = [task('seed-1')];
    const cache = {
      tasks: [task('seed-1'), task('parallel-window')],
      snapshotVersion: 5,
      locallyCreatedIds: new Set<string>(),
    };
    const result = mergeWithCache(seed, cache, new Set(), 5);
    expect(result.map((t) => t.id).sort()).toEqual(['parallel-window', 'seed-1']);
  });

  it('newer cached updated time wins for ids in both', () => {
    const seed = [task('a', { title: 'old', updated: NOW })];
    const cache = {
      tasks: [task('a', { title: 'new', updated: LATER })],
      snapshotVersion: 1,
      locallyCreatedIds: new Set<string>(),
    };
    const result = mergeWithCache(seed, cache, new Set(), 2);
    expect(result[0].title).toBe('new');
  });

  it('tombstoned ids are dropped from both seed and cache', () => {
    const seed = [task('a'), task('b')];
    const cache = {
      tasks: [task('c')],
      snapshotVersion: 1,
      locallyCreatedIds: new Set(['c']),
    };
    const result = mergeWithCache(seed, cache, new Set(['a', 'c']), 2);
    expect(result.map((t) => t.id)).toEqual(['b']);
  });

  it('archived (status != active) tasks are filtered out', () => {
    const seed = [task('a'), task('b', { status: 'archived' })];
    const cache = {
      tasks: [],
      snapshotVersion: 1,
      locallyCreatedIds: new Set<string>(),
    };
    const result = mergeWithCache(seed, cache, new Set(), 2);
    expect(result.map((t) => t.id)).toEqual(['a']);
  });
});

describe('storage v3 envelope', () => {
  it('returns empty cache when nothing is stored', () => {
    const cache = storage.loadCache();
    expect(cache.tasks).toEqual([]);
    expect(cache.snapshotVersion).toBe(0);
    expect(cache.locallyCreatedIds.size).toBe(0);
  });

  it('saveTasks + loadCache round-trips', () => {
    storage.saveTasks([task('a'), task('b')], 3);
    const cache = storage.loadCache();
    expect(cache.tasks.map((t) => t.id).sort()).toEqual(['a', 'b']);
    expect(cache.snapshotVersion).toBe(3);
  });

  it('strips ghost ids defensively on load', () => {
    // Stamp a v3 envelope directly with a ghost id.
    localStorage.setItem(
      'cowork-tasks:cache:v3',
      JSON.stringify({
        schemaVersion: 3,
        snapshotVersion: 1,
        tasks: [task('real'), task('t3')],
        locallyCreatedIds: ['real', 't9'],
      }),
    );
    const cache = storage.loadCache();
    expect(cache.tasks.map((t) => t.id)).toEqual(['real']);
    expect(Array.from(cache.locallyCreatedIds)).toEqual(['real']);
  });

  it('markLocallyCreated tracks new ids', () => {
    storage.markLocallyCreated('local-1');
    storage.markLocallyCreated('local-2');
    const cache = storage.loadCache();
    expect(Array.from(cache.locallyCreatedIds).sort()).toEqual(['local-1', 'local-2']);
  });

  it('unmarkLocallyCreated removes ids', () => {
    storage.markLocallyCreated('a');
    storage.markLocallyCreated('b');
    storage.unmarkLocallyCreated('a');
    const cache = storage.loadCache();
    expect(Array.from(cache.locallyCreatedIds)).toEqual(['b']);
  });

  it('migrates v2 keys, dropping ghost ids', () => {
    // Seed legacy v2 state.
    localStorage.setItem(
      'cowork-tasks:tasks:v2',
      JSON.stringify([task('keep'), task('t1'), task('t5')]),
    );
    localStorage.setItem('cowork-tasks:version:v2', '7');
    localStorage.setItem('cowork-tasks:tombstones:v2', JSON.stringify(['old']));

    const cache = storage.loadCache();
    expect(cache.tasks.map((t) => t.id)).toEqual(['keep']);
    expect(cache.snapshotVersion).toBe(7);

    // Tombstones migrate too.
    expect(Array.from(storage.loadTombstones())).toEqual(['old']);

    // Legacy keys gone.
    expect(localStorage.getItem('cowork-tasks:tasks:v2')).toBeNull();
    expect(localStorage.getItem('cowork-tasks:version:v2')).toBeNull();
  });

  it('clear() wipes both v3 envelope and any leftover legacy keys', () => {
    storage.saveTasks([task('a')], 1);
    localStorage.setItem('cowork-tasks:tasks:v2', '[]');
    storage.clear();
    expect(localStorage.getItem('cowork-tasks:cache:v3')).toBeNull();
    expect(localStorage.getItem('cowork-tasks:tasks:v2')).toBeNull();
  });
});
