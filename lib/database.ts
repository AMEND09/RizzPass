import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(process.cwd(), 'passwords.db');
const db = new Database(dbPath);

// Export db
export { db };

// Initialize database tables (ensure fresh installs have correct schema)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  encryption_salt TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS passkeys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    credential_id TEXT UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    counter INTEGER DEFAULT 0,
    transports TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS passwords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    username TEXT,
    password TEXT NOT NULL,
    website TEXT,
    category TEXT DEFAULT 'general',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_passwords_user_id ON passwords(user_id);
  CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
`);

// Runtime migration: if encryption_salt column missing (older DB), add it and populate existing users
try {
  const row = db.prepare(`PRAGMA table_info(users)`).all();
  const hasSalt = row.some((r: any) => r.name === 'encryption_salt');
  if (!hasSalt) {
    // Add the column with a default empty string so ALTER succeeds
    db.exec(`ALTER TABLE users ADD COLUMN encryption_salt TEXT`);

    // Generate random salts for existing users
    const users = db.prepare(`SELECT id FROM users`).all();
    const crypto = require('crypto');
    const update = db.prepare(`UPDATE users SET encryption_salt = ? WHERE id = ?`);
    const insertMany = db.transaction((rows: any[]) => {
      for (const u of rows) {
        const salt = crypto.randomBytes(16).toString('hex');
        update.run(salt, u.id);
      }
    });
    insertMany(users);
  }
} catch (err) {
  // If anything goes wrong, log it and continue; missing column errors are already handled
  console.error('Database migration check failed:', err);
}

// Runtime migration: if username column missing (older DB), add it and populate unique usernames
try {
  const row = db.prepare(`PRAGMA table_info(users)`).all();
  const hasUsername = row.some((r: any) => r.name === 'username');
  if (!hasUsername) {
    // Add the column
    db.exec(`ALTER TABLE users ADD COLUMN username TEXT`);

    // Populate usernames derived from email local part and ensure uniqueness
    const users = db.prepare(`SELECT id, email FROM users`).all() as { id: number; email: string }[];
    const update = db.prepare(`UPDATE users SET username = ? WHERE id = ?`);
    const exists = db.prepare(`SELECT id FROM users WHERE username = ?`);
    for (const u of users) {
      const local = (u.email || '').split('@')[0] || `user${u.id}`;
      // normalize: lowercase and replace non-alphanum with '-'
      let candidate = local.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      if (!candidate) candidate = `user${u.id}`;
      let suffix = 1;
      let uniqueCandidate = candidate;
      while (true) {
        const found = exists.get(uniqueCandidate) as { id: number } | undefined;
        if (!found) break;
        suffix += 1;
        uniqueCandidate = `${candidate}-${suffix}`;
      }
      update.run(uniqueCandidate, u.id);
    }

    // Create a unique index on username to enforce uniqueness for future inserts
    try {
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users(username)`);
    } catch (e) {
      console.warn('Could not create unique index on username:', e);
    }
  }
} catch (err) {
  console.error('Username migration check failed:', err);
}

export interface User {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  encryption_salt: string;
  created_at: string;
}

export interface Password {
  id: number;
  user_id: number;
  title: string;
  username?: string;
  password: string;
  website?: string;
  category: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  user_id: number;
  name: string;
  color: string;
  created_at: string;
}

export const userQueries = {
  create: db.prepare(`
  INSERT INTO users (email, username, password_hash, encryption_salt)
  VALUES (?, ?, ?, ?)
  `),
  findByEmail: db.prepare(`
    SELECT * FROM users WHERE email = ?
  `),
  
  findByUsername: db.prepare(`
    SELECT * FROM users WHERE username = ?
  `),
  
  findById: db.prepare(`
    SELECT * FROM users WHERE id = ?
  `)
};

export const passwordQueries = {
  create: db.prepare(`
    INSERT INTO passwords (user_id, title, username, password, website, category, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  
  findByUserId: db.prepare(`
    SELECT * FROM passwords WHERE user_id = ? ORDER BY updated_at DESC
  `),
  
  findById: db.prepare(`
    SELECT * FROM passwords WHERE id = ? AND user_id = ?
  `),
  
  update: db.prepare(`
    UPDATE passwords 
    SET title = ?, username = ?, password = ?, website = ?, category = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `),
  
  delete: db.prepare(`
    DELETE FROM passwords WHERE id = ? AND user_id = ?
  `),
  
  search: db.prepare(`
    SELECT * FROM passwords 
    WHERE user_id = ? AND (title LIKE ? OR username LIKE ? OR website LIKE ?)
    ORDER BY updated_at DESC
  `)
};

export const categoryQueries = {
  create: db.prepare(`
    INSERT INTO categories (user_id, name, color)
    VALUES (?, ?, ?)
  `),
  
  findByUserId: db.prepare(`
    SELECT * FROM categories WHERE user_id = ? ORDER BY name ASC
  `),
  
  update: db.prepare(`
    UPDATE categories SET name = ?, color = ? WHERE id = ? AND user_id = ?
  `),
  
  delete: db.prepare(`
    DELETE FROM categories WHERE id = ? AND user_id = ?
  `)
};

export async function createUser(email: string, password: string, username?: string): Promise<User> {
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  
  // Generate a random encryption salt for client-side key derivation
  const encryptionSalt = require('crypto').randomBytes(16).toString('hex');

  // Derive username from email local part if not provided (fallback)
  const finalUsername = username && username.trim().length > 0 ? username.trim() : email.split('@')[0];

  const result = userQueries.create.run(email, finalUsername, hashedPassword, encryptionSalt);
  const user = userQueries.findById.get(result.lastInsertRowid) as User;
  return user;
}

export async function verifyUser(identifier: string, password: string): Promise<User | null> {
  // identifier can be email or username
  let user = userQueries.findByEmail.get(identifier) as User;
  if (!user) {
    user = userQueries.findByUsername.get(identifier) as User;
  }
  if (!user) return null;
  
  const isValid = await bcrypt.compare(password, user.password_hash);
  return isValid ? user : null;
}

export default db;