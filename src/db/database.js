import * as SQLite from 'expo-sqlite';

let db;

export async function getDb() {
  if (!db) {
    db = await SQLite.openDatabaseAsync('finance.db');
  }
  return db;
}

export async function initDB() {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      month TEXT NOT NULL,
      UNIQUE(category, month)
    );
  `);

  // Migration: add recurring column if it doesn't exist yet
  try {
    await db.execAsync(`ALTER TABLE transactions ADD COLUMN recurring INTEGER NOT NULL DEFAULT 0;`);
  } catch (_) {
    // Column already exists — safe to ignore
  }
}

// ─── Transactions ────────────────────────────────────────────────────────────

export async function addTransaction({ type, amount, category, description, date, recurring = 0 }) {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO transactions (type, amount, category, description, date, recurring) VALUES (?, ?, ?, ?, ?, ?)`,
    [type, amount, category, description || '', date, recurring ? 1 : 0]
  );
  return result.lastInsertRowId;
}

export async function updateTransaction({ id, type, amount, category, description, date, recurring = 0 }) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE transactions SET type = ?, amount = ?, category = ?, description = ?, date = ?, recurring = ? WHERE id = ?`,
    [type, amount, category, description || '', date, recurring ? 1 : 0, id]
  );
}

export async function getTransactions({ month, type, limit, offset = 0, search, sortBy = 'date', sortDir = 'DESC' } = {}) {
  const db = await getDb();
  const conditions = [];
  const params = [];

  if (month) {
    conditions.push(`strftime('%Y-%m', date) = ?`);
    params.push(month);
  }
  if (type && type !== 'All') {
    conditions.push(`type = ?`);
    params.push(type.toLowerCase());
  }
  if (search) {
    conditions.push(`(LOWER(description) LIKE ? OR LOWER(category) LIKE ?)`);
    params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const order = `ORDER BY ${sortBy === 'amount' ? 'amount' : 'date'} ${sortDir === 'ASC' ? 'ASC' : 'DESC'}`;

  if (limit != null) {
    params.push(limit, offset);
    return await db.getAllAsync(
      `SELECT * FROM transactions ${where} ${order} LIMIT ? OFFSET ?`,
      params
    );
  }

  return await db.getAllAsync(`SELECT * FROM transactions ${where} ${order}`, params);
}

export async function getTransactionCount({ type, search } = {}) {
  const db = await getDb();
  const conditions = [];
  const params = [];

  if (type && type !== 'All') {
    conditions.push(`type = ?`);
    params.push(type.toLowerCase());
  }
  if (search) {
    conditions.push(`(LOWER(description) LIKE ? OR LOWER(category) LIKE ?)`);
    params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) as count FROM transactions ${where}`,
    params
  );
  return row.count;
}

export async function deleteTransaction(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM transactions WHERE id = ?`, [id]);
}

export async function getMonthlySummary(month) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT type, SUM(amount) as total FROM transactions
     WHERE strftime('%Y-%m', date) = ?
     GROUP BY type`,
    [month]
  );
  const summary = { income: 0, expense: 0 };
  rows.forEach(r => { summary[r.type] = r.total; });
  summary.balance = summary.income - summary.expense;
  return summary;
}

export async function getCategoryBreakdown(month) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT category, SUM(amount) as total FROM transactions
     WHERE type = 'expense' AND strftime('%Y-%m', date) = ?
     GROUP BY category
     ORDER BY total DESC`,
    [month]
  );
}

export async function getMonthlyTrend(numMonths = 6) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT strftime('%Y-%m', date) as month, type, SUM(amount) as total
     FROM transactions
     WHERE date >= date('now', '-${numMonths} months')
     GROUP BY month, type
     ORDER BY month ASC`
  );
}

// ─── Budgets ─────────────────────────────────────────────────────────────────

export async function setBudget({ category, amount, month }) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO budgets (category, amount, month) VALUES (?, ?, ?)
     ON CONFLICT(category, month) DO UPDATE SET amount = excluded.amount`,
    [category, amount, month]
  );
}

export async function getBudgets(month) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT b.id, b.category, b.amount, b.month,
            COALESCE(SUM(t.amount), 0) as spent
     FROM budgets b
     LEFT JOIN transactions t
       ON t.category = b.category
       AND t.type = 'expense'
       AND strftime('%Y-%m', t.date) = ?
     WHERE b.month = ?
     GROUP BY b.id`,
    [month, month]
  );
}

export async function deleteBudget(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM budgets WHERE id = ?`, [id]);
}

// ─── Backup / Restore ────────────────────────────────────────────────────────

export async function getAllTransactionsForExport() {
  const db = await getDb();
  return await db.getAllAsync(`SELECT * FROM transactions ORDER BY date DESC`);
}

export async function getAllBudgetsForExport() {
  const db = await getDb();
  return await db.getAllAsync(`SELECT * FROM budgets`);
}

export async function importFromBackup({ transactions, budgets }) {
  const db = await getDb();
  await db.execAsync(`DELETE FROM transactions;`);
  await db.execAsync(`DELETE FROM budgets;`);
  for (const t of transactions) {
    await db.runAsync(
      `INSERT INTO transactions (id, type, amount, category, description, date, recurring) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [t.id, t.type, t.amount, t.category, t.description || '', t.date, t.recurring || 0]
    );
  }
  for (const b of budgets) {
    await db.runAsync(
      `INSERT INTO budgets (id, category, amount, month) VALUES (?, ?, ?, ?)`,
      [b.id, b.category, b.amount, b.month]
    );
  }
}
