import type { DiffRow } from '../types/DiffRow';

export function computeDiff(before: string, after: string): DiffRow[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ kind: 'same', left: a[i], right: b[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ kind: 'del', left: a[i] });
      i++;
    } else {
      rows.push({ kind: 'add', right: b[j] });
      j++;
    }
  }
  while (i < n) rows.push({ kind: 'del', left: a[i++] });
  while (j < m) rows.push({ kind: 'add', right: b[j++] });
  return rows;
}
