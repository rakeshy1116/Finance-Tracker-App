import * as SQLite from 'expo-sqlite';
import { currentMonth, offsetMonth, todayISO } from '../utils/helpers';

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

    CREATE TABLE IF NOT EXISTS custom_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
      emoji TEXT NOT NULL DEFAULT '💰',
      color TEXT NOT NULL DEFAULT '#94A3B8'
    );

    CREATE TABLE IF NOT EXISTS savings_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      saved_amount REAL NOT NULL DEFAULT 0,
      deadline TEXT,
      emoji TEXT NOT NULL DEFAULT '🎯',
      color TEXT NOT NULL DEFAULT '#0D9488'
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('cash', 'bank', 'credit')),
      color TEXT NOT NULL DEFAULT '#0D9488',
      icon TEXT NOT NULL DEFAULT '💳'
    );
  `);

  // Migration: add recurring column if it doesn't exist yet
  try {
    await db.execAsync(`ALTER TABLE transactions ADD COLUMN recurring INTEGER NOT NULL DEFAULT 0;`);
  } catch (_) {
    // Column already exists — safe to ignore
  }

  // Migration: add account_id column to transactions
  try {
    await db.execAsync(`ALTER TABLE transactions ADD COLUMN account_id INTEGER DEFAULT 1;`);
  } catch (_) {
    // Column already exists — safe to ignore
  }

  // Seed default accounts if none exist
  const accountCount = await db.getFirstAsync(`SELECT COUNT(*) as count FROM accounts`);
  if (accountCount.count === 0) {
    await db.execAsync(`
      INSERT INTO accounts (name, type, color, icon) VALUES ('Cash', 'cash', '#22C55E', '💵');
      INSERT INTO accounts (name, type, color, icon) VALUES ('Bank', 'bank', '#3B82F6', '🏦');
      INSERT INTO accounts (name, type, color, icon) VALUES ('Credit Card', 'credit', '#F59E0B', '💳');
    `);
  }

  // Process recurring transactions on every app start
  await processRecurringTransactions();
}

// ─── Transactions ────────────────────────────────────────────────────────────

export async function addTransaction({ type, amount, category, description, date, recurring = 0, account_id = 1 }) {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO transactions (type, amount, category, description, date, recurring, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [type, amount, category, description || '', date, recurring ? 1 : 0, account_id || 1]
  );
  return result.lastInsertRowId;
}

export async function updateTransaction({ id, type, amount, category, description, date, recurring = 0, account_id = 1 }) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE transactions SET type = ?, amount = ?, category = ?, description = ?, date = ?, recurring = ?, account_id = ? WHERE id = ?`,
    [type, amount, category, description || '', date, recurring ? 1 : 0, account_id || 1, id]
  );
}

export async function duplicateTransaction(id) {
  const db = await getDb();
  const original = await db.getFirstAsync(`SELECT * FROM transactions WHERE id = ?`, [id]);
  if (!original) return null;
  const result = await db.runAsync(
    `INSERT INTO transactions (type, amount, category, description, date, recurring, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [original.type, original.amount, original.category, original.description || '', todayISO(), original.recurring, original.account_id || 1]
  );
  return result.lastInsertRowId;
}

export async function getTransactions({
  month,
  type,
  limit,
  offset = 0,
  search,
  sortBy = 'date',
  sortDir = 'DESC',
  minAmount,
  maxAmount,
  fromDate,
  toDate,
  account_id,
} = {}) {
  const db = await getDb();
  const conditions = [];
  const params = [];

  if (fromDate && toDate) {
    conditions.push(`date >= ? AND date <= ?`);
    params.push(fromDate, toDate);
  } else if (month) {
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
  if (minAmount != null && !isNaN(minAmount)) {
    conditions.push(`amount >= ?`);
    params.push(minAmount);
  }
  if (maxAmount != null && !isNaN(maxAmount)) {
    conditions.push(`amount <= ?`);
    params.push(maxAmount);
  }
  if (account_id != null) {
    conditions.push(`account_id = ?`);
    params.push(account_id);
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

export async function getTransactionCount({ type, search, minAmount, maxAmount, fromDate, toDate, account_id } = {}) {
  const db = await getDb();
  const conditions = [];
  const params = [];

  if (fromDate && toDate) {
    conditions.push(`date >= ? AND date <= ?`);
    params.push(fromDate, toDate);
  }
  if (type && type !== 'All') {
    conditions.push(`type = ?`);
    params.push(type.toLowerCase());
  }
  if (search) {
    conditions.push(`(LOWER(description) LIKE ? OR LOWER(category) LIKE ?)`);
    params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
  }
  if (minAmount != null && !isNaN(minAmount)) {
    conditions.push(`amount >= ?`);
    params.push(minAmount);
  }
  if (maxAmount != null && !isNaN(maxAmount)) {
    conditions.push(`amount <= ?`);
    params.push(maxAmount);
  }
  if (account_id != null) {
    conditions.push(`account_id = ?`);
    params.push(account_id);
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

export async function getLastMonthSummary(month) {
  const prevMonth = offsetMonth(month, -1);
  return getMonthlySummary(prevMonth);
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

export async function getCategoryTrend(numMonths = 4) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT strftime('%Y-%m', date) as month, category, SUM(amount) as total
     FROM transactions
     WHERE type = 'expense' AND date >= date('now', '-${numMonths} months')
     GROUP BY month, category
     ORDER BY month ASC`
  );
}

// ─── Recurring Transactions ───────────────────────────────────────────────────

export async function processRecurringTransactions() {
  const db = await getDb();
  const month = currentMonth();
  const today = todayISO();

  const recurring = await db.getAllAsync(
    `SELECT DISTINCT category, type, amount, description, account_id
     FROM transactions
     WHERE recurring = 1`
  );

  for (const txn of recurring) {
    const existing = await db.getFirstAsync(
      `SELECT id FROM transactions
       WHERE category = ? AND type = ? AND recurring = 1
       AND strftime('%Y-%m', date) = ?`,
      [txn.category, txn.type, month]
    );
    if (!existing) {
      await db.runAsync(
        `INSERT INTO transactions (type, amount, category, description, date, recurring, account_id)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [txn.type, txn.amount, txn.category, txn.description || '', today, txn.account_id || 1]
      );
    }
  }
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

// ─── Custom Categories ────────────────────────────────────────────────────────

export async function getCustomCategories() {
  const db = await getDb();
  return await db.getAllAsync(`SELECT * FROM custom_categories ORDER BY name ASC`);
}

export async function addCustomCategory({ name, type, emoji, color }) {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO custom_categories (name, type, emoji, color) VALUES (?, ?, ?, ?)`,
    [name, type, emoji || '💰', color || '#94A3B8']
  );
  return result.lastInsertRowId;
}

export async function deleteCustomCategory(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM custom_categories WHERE id = ?`, [id]);
}

// ─── Savings Goals ────────────────────────────────────────────────────────────

export async function getSavingsGoals() {
  const db = await getDb();
  return await db.getAllAsync(`SELECT * FROM savings_goals ORDER BY id DESC`);
}

export async function addSavingsGoal({ name, target_amount, deadline, emoji, color }) {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO savings_goals (name, target_amount, saved_amount, deadline, emoji, color)
     VALUES (?, ?, 0, ?, ?, ?)`,
    [name, target_amount, deadline || null, emoji || '🎯', color || '#0D9488']
  );
  return result.lastInsertRowId;
}

export async function updateSavingsGoal(id, updates) {
  const db = await getDb();
  const keys = Object.keys(updates);
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => updates[k]);
  await db.runAsync(
    `UPDATE savings_goals SET ${setClause} WHERE id = ?`,
    [...values, id]
  );
}

export async function deleteSavingsGoal(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM savings_goals WHERE id = ?`, [id]);
}

export async function contributeToGoal(id, amount) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE savings_goals SET saved_amount = saved_amount + ? WHERE id = ?`,
    [amount, id]
  );
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export async function getAccounts() {
  const db = await getDb();
  return await db.getAllAsync(`SELECT * FROM accounts ORDER BY id ASC`);
}

export async function addAccount({ name, type, color, icon }) {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO accounts (name, type, color, icon) VALUES (?, ?, ?, ?)`,
    [name, type, color || '#0D9488', icon || '💳']
  );
  return result.lastInsertRowId;
}

export async function deleteAccount(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM accounts WHERE id = ?`, [id]);
}

export async function getNetWorth() {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT a.id, a.name, a.color, a.icon,
       COALESCE(
         SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) -
         SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END),
         0
       ) as balance
     FROM accounts a
     LEFT JOIN transactions t ON t.account_id = a.id
     GROUP BY a.id
     ORDER BY a.id ASC`
  );
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
      `INSERT INTO transactions (id, type, amount, category, description, date, recurring, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.id, t.type, t.amount, t.category, t.description || '', t.date, t.recurring || 0, t.account_id || 1]
    );
  }
  for (const b of budgets) {
    await db.runAsync(
      `INSERT INTO budgets (id, category, amount, month) VALUES (?, ?, ?, ?)`,
      [b.id, b.category, b.amount, b.month]
    );
  }
}
