import { EVENT } from './config.mjs';
import { randomPassCode } from './crypto.mjs';

// Short codes live only in the private database, authenticated guest's pass,
// and protected staff portal. They are NOT public bearer authentication.
export async function issuePass(env, entry, now, candidate = randomPassCode) {
  if (!entry || entry.eligible_ms == null || now < EVENT.midnight || now >= EVENT.expires) return null;
  const existing = () => env.DB.prepare('SELECT short_code FROM passes WHERE entry_id=?').bind(entry.id).first();
  let found = await existing();
  if (found) return found.short_code;
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = candidate();
    await env.DB.prepare(`INSERT INTO passes(id,campaign,entry_id,short_code,issued_ms,expires_ms)
      SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM entries WHERE id=? AND eligible_ms IS NOT NULL)
      ON CONFLICT DO NOTHING`)
      .bind(crypto.randomUUID(),EVENT.id,entry.id,code,now,EVENT.expires,entry.id).run();
    found = await existing();
    if (found) return found.short_code; // Includes another simultaneous claim's winner.
  }
  // Rare collision-pressure fallback: allocate an unused gap in ONE SQL statement.
  // Includes redeemed/expired rows: a code is never recycled during this campaign.
  await env.DB.prepare(`WITH candidates(n) AS (
      SELECT 10000 UNION ALL SELECT CAST(short_code AS INTEGER)+1 FROM passes
      WHERE campaign=? AND short_code<'99999'
    ) INSERT INTO passes(id,campaign,entry_id,short_code,issued_ms,expires_ms)
    SELECT ?,?,?,CAST(n AS TEXT),?,? FROM candidates
    WHERE NOT EXISTS(SELECT 1 FROM passes WHERE campaign=? AND short_code=CAST(n AS TEXT))
      AND EXISTS(SELECT 1 FROM entries WHERE id=? AND eligible_ms IS NOT NULL)
    ORDER BY n LIMIT 1 ON CONFLICT DO NOTHING`)
    .bind(EVENT.id,crypto.randomUUID(),EVENT.id,entry.id,now,EVENT.expires,EVENT.id,entry.id).run();
  found = await existing();
  if (found) return found.short_code;
  throw Object.assign(new Error('No cookie code is available. Eligibility is retained; no pass is confirmed.'),{status:503});
}
