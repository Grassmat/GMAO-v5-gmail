import type { Row } from './types';
// Existing machines retain their original order; newly added machines go last.
export function orderedMachines(rows: Row[]) {
  return [...rows].sort((a,b) => (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER)
    || (a.creationOrder ?? 0) - (b.creationOrder ?? 0) || a.id.localeCompare(b.id));
}
export function movedMachines(rows: Row[], source: string, target: string) {
  const ids = rows.map(row => row.id), from = ids.indexOf(source), to = ids.indexOf(target);
  if (from < 0 || to < 0 || from === to) return ids;
  ids.splice(to,0,ids.splice(from,1)[0]);
  return ids;
}
