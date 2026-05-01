import { promises as fs } from 'node:fs';
import type { FsAdapter } from './fs-adapter.js';

export const nodeFs: FsAdapter = {
  async readFile(path) {
    return fs.readFile(path, 'utf-8');
  },
  async writeFile(path, content) {
    await fs.writeFile(path, content, 'utf-8');
  },
  async exists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  },
  async mkdir(path, recursive = true) {
    await fs.mkdir(path, { recursive });
  },
  async rename(from, to) {
    await fs.rename(from, to);
  },
  async unlink(path) {
    await fs.unlink(path);
  },
  async readdir(path) {
    return fs.readdir(path);
  },
  async stat(path) {
    const s = await fs.stat(path);
    return {
      isFile: s.isFile(),
      isDirectory: s.isDirectory(),
      mtimeMs: s.mtimeMs,
    };
  },
};
