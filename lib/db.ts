import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let dbInstance: Database | null = null;

export async function getDB(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const dbPath = path.join(process.cwd(), 'outreach.db');
  
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  // Create tables
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      name TEXT,
      picture TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      user_email TEXT,
      subject TEXT,
      body TEXT,
      sender_email TEXT,
      sender_password TEXT,
      total_contacts INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active', -- 'active', 'paused', 'completed', 'held_rate_limit'
      enable_safe_mode INTEGER DEFAULT 1,
      enable_ai_spintax INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_email) REFERENCES users(email)
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      campaign_id TEXT,
      name TEXT,
      email TEXT,
      company TEXT,
      status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
      error_message TEXT,
      sent_subject TEXT,
      sent_body TEXT,
      sent_at DATETIME,
      FOREIGN KEY(campaign_id) REFERENCES campaigns(id)
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      session_id TEXT PRIMARY KEY,
      user_email TEXT,
      login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_agent TEXT,
      ip_address TEXT,
      FOREIGN KEY(user_email) REFERENCES users(email)
    );
  `);

  // Add configuration columns to users table if they don't exist
  try {
    await dbInstance.exec(`ALTER TABLE users ADD COLUMN sender_email TEXT;`);
  } catch (e) {}
  try {
    await dbInstance.exec(`ALTER TABLE users ADD COLUMN sender_password TEXT;`);
  } catch (e) {}
  try {
    await dbInstance.exec(`ALTER TABLE users ADD COLUMN gemini_api_key TEXT;`);
  } catch (e) {}

  return dbInstance;
}
