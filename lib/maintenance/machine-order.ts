import { allowSite, AppError, type User } from '../auth';
import { database } from '../store';
import { validSite } from './repository';
export async function saveMachineOrder(user: User, input: any) {
  if (typeof input.site !== 'string' || !Array.isArray(input.ids) || !Array.isArray(input.expected)
    || !input.ids.length || input.ids.length > 10000 || input.expected.length !== input.ids.length
    || input.ids.some((id: unknown) => typeof id !== 'string') || new Set(input.ids).size !== input.ids.length
    || input.expected.some((row: any) => !row || typeof row.id !== 'string' || !(row.order === null || (Number.isSafeInteger(row.order) && row.order >= 0)))
    || new Set(input.expected.map((row: any) => row.id)).size !== input.ids.length
    || input.expected.some((row: any) => !input.ids.includes(row.id))) throw new AppError('Ordre des machines invalide.');
  allowSite(user,input.site);
  await validSite(input.site);
  // One atomic statement: freeze the pre-update check, then patch only the rank.
  // Concurrent additions or reorderings cannot produce a partial order.
  const result = await database().prepare(`WITH guard AS MATERIALIZED (
    SELECT (SELECT COUNT(*) FROM records WHERE kind='machine' AND site=?) = json_array_length(?)
      AND NOT EXISTS (SELECT 1 FROM json_each(?) e LEFT JOIN records r ON r.id=json_extract(e.value,'$.id') AND r.kind='machine' AND r.site=?
        WHERE r.id IS NULL OR json_extract(r.data,'$.displayOrder') IS NOT json_extract(e.value,'$.order')) AS ok
  ) UPDATE records SET data=json_set(data,'$.displayOrder',(SELECT CAST(key AS INTEGER) FROM json_each(?) WHERE value=records.id))
    WHERE kind='machine' AND site=? AND (SELECT ok FROM guard)`).bind(input.site,JSON.stringify(input.ids),JSON.stringify(input.expected),input.site,JSON.stringify(input.ids),input.site).run();
  if (result.meta.changes !== input.ids.length) throw new AppError('La liste ou son ordre a changé. Actualisez puis réessayez.',409);
}
