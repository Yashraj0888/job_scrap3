import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'outreach.db');

interface SqliteWrapper {
  get<T = Record<string, any>>(sql: string, params?: any[]): Promise<T | undefined>;
  all<T = Record<string, any>>(sql: string, params?: any[]): Promise<T[]>;
  run(sql: string, params?: any[]): Promise<{ lastID: number; changes: number }>;
  exec(sql: string): Promise<void>;
}

let wrapper: SqliteWrapper | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    if (db) {
      const data = db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    }
  }, 200);
}

let db: SqlJsDatabase | null = null;

function toObjects(sql: string, params?: any[]): Record<string, any>[] {
  if (!db) return [];

  if (params && params.length > 0) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows: Record<string, any>[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  const results = db.exec(sql);
  if (!results || results.length === 0) return [];

  const { columns, values } = results[0];
  if (!values || values.length === 0) return [];

  return values.map((row) => {
    const obj: Record<string, any> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

export async function getDB(): Promise<SqliteWrapper> {
  if (wrapper) return wrapper;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('CREATE TABLE IF NOT EXISTS users ('
    + 'email TEXT PRIMARY KEY, name TEXT, picture TEXT,'
    + 'sender_email TEXT, sender_password TEXT, gemini_api_key TEXT,'
    + 'created_at DATETIME DEFAULT CURRENT_TIMESTAMP'
    + ')');

  db.run('CREATE TABLE IF NOT EXISTS campaigns ('
    + 'id TEXT PRIMARY KEY, user_email TEXT, subject TEXT, body TEXT,'
    + 'sender_email TEXT, sender_password TEXT,'
    + 'total_contacts INTEGER DEFAULT 0, sent_count INTEGER DEFAULT 0,'
    + 'failed_count INTEGER DEFAULT 0,'
    + "status TEXT DEFAULT 'active',"
    + 'enable_safe_mode INTEGER DEFAULT 1, enable_ai_spintax INTEGER DEFAULT 0,'
    + 'created_at DATETIME DEFAULT CURRENT_TIMESTAMP,'
    + 'FOREIGN KEY(user_email) REFERENCES users(email)'
    + ')');

  db.run('CREATE TABLE IF NOT EXISTS contacts ('
    + 'id TEXT PRIMARY KEY, campaign_id TEXT, name TEXT, email TEXT,'
    + 'company TEXT, status TEXT DEFAULT \'pending\', error_message TEXT,'
    + 'sent_subject TEXT, sent_body TEXT, sent_at DATETIME,'
    + 'FOREIGN KEY(campaign_id) REFERENCES campaigns(id)'
    + ')');

  db.run('CREATE TABLE IF NOT EXISTS user_sessions ('
    + 'session_id TEXT PRIMARY KEY, user_email TEXT,'
    + 'login_time DATETIME DEFAULT CURRENT_TIMESTAMP, user_agent TEXT, ip_address TEXT,'
    + 'FOREIGN KEY(user_email) REFERENCES users(email)'
    + ')');

  // Add columns to users if they don't exist (sql.js ignores ALTER errors)
  try { db.run('ALTER TABLE users ADD COLUMN sender_email TEXT'); } catch {}
  try { db.run('ALTER TABLE users ADD COLUMN sender_password TEXT'); } catch {}
  try { db.run('ALTER TABLE users ADD COLUMN gemini_api_key TEXT'); } catch {}

  scheduleSave();

  wrapper = {
    async get<T>(sql: string, params?: any[]): Promise<T | undefined> {
      const rows = toObjects(sql, params);
      return rows[0] as T | undefined;
    },

    async all<T>(sql: string, params?: any[]): Promise<T[]> {
      return toObjects(sql, params) as T[];
    },

    async run(sql: string, params?: any[]): Promise<{ lastID: number; changes: number }> {
      if (params && params.length > 0) {
        const stmt = db!.prepare(sql);
        stmt.bind(params);
        stmt.step();
        stmt.free();
      } else {
        db!.run(sql);
      }
      scheduleSave();
      return { lastID: 0, changes: 0 };
    },

    async exec(sql: string): Promise<void> {
      db!.run(sql);
      scheduleSave();
    },
  };

  return wrapper;
}
