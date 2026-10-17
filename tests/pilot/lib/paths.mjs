// Stier relativt til repoets rod – uafhængigt af hvor `node --test` startes fra.
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const PILOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(PILOT_DIR, '..', '..');
export const CACHE_DIR = path.join(PILOT_DIR, '.cache');
export const repoPath = (...parts) => path.join(REPO_ROOT, ...parts);
export const repoUrl = (...parts) => pathToFileURL(repoPath(...parts)).href;
