const enc = new TextEncoder();
export async function sha256(text) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)));
  return Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('');
}
export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,'0')).join('');
}
export function randomPassCode() {
  // Rejection sampling avoids modulo bias. No sequential public counter.
  const range = 90000, ceiling = Math.floor(4294967296 / range) * range;
  const word = new Uint32Array(1);
  do { crypto.getRandomValues(word); } while (word[0] >= ceiling);
  return String(10000 + word[0] % range);
}
