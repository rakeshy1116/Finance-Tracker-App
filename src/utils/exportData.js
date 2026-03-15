import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getTransactions, getAllTransactionsForExport, getAllBudgetsForExport, importFromBackup } from '../db/database';

function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportAsCSV() {
  const transactions = await getTransactions();

  const headers = ['Date', 'Type', 'Category', 'Description', 'Amount (USD)', 'Recurring'];
  const rows = transactions.map(t => [
    t.date,
    t.type,
    t.category,
    t.description || '',
    t.type === 'expense' ? -t.amount : t.amount,
    t.recurring ? 'Yes' : 'No',
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(escapeCSV).join(','))
    .join('\n');

  const filename = `finance_export_${new Date().toISOString().slice(0, 10)}.csv`;
  const fileUri = FileSystem.documentDirectory + filename;

  await FileSystem.writeAsStringAsync(fileUri, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export Finance Data',
    UTI: 'public.comma-separated-values-text',
  });
}

export async function exportAsJSON() {
  const [transactions, budgets] = await Promise.all([
    getAllTransactionsForExport(),
    getAllBudgetsForExport(),
  ]);

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions,
    budgets,
  };

  const json = JSON.stringify(payload, null, 2);
  const filename = `finance_backup_${new Date().toISOString().slice(0, 10)}.json`;
  const fileUri = FileSystem.documentDirectory + filename;

  await FileSystem.writeAsStringAsync(fileUri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device');

  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/json',
    dialogTitle: 'Backup Finance Data',
    UTI: 'public.json',
  });
}

export async function importFromJSON(fileUri) {
  const raw = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const payload = JSON.parse(raw);

  if (!payload.version || !Array.isArray(payload.transactions) || !Array.isArray(payload.budgets)) {
    throw new Error('Invalid backup file format');
  }

  await importFromBackup({ transactions: payload.transactions, budgets: payload.budgets });
}
