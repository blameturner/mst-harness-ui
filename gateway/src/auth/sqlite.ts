import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { env } from '../env.js';

// Resolve file:... DATABASE_URL to a path and ensure its directory exists.
const dbPath = env.DATABASE_URL.replace(/^file:/, '');
mkdirSync(dirname(dbPath), { recursive: true });

export const sqlite = new Database(dbPath);
