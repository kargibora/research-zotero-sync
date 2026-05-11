const KEY = 'syncIndex';

export function createSyncState({ storage }) {
  if (!storage) throw new Error('createSyncState: storage required');

  function indexKey(source, sourceId) { return `${source}:${sourceId}`; }

  async function readAll() {
    const obj = await storage.get(KEY);
    return obj?.[KEY] || {};
  }

  async function writeAll(map) {
    await storage.set({ [KEY]: map });
  }

  async function get(source, sourceId) {
    const all = await readAll();
    return all[indexKey(source, sourceId)] || null;
  }

  async function put(source, sourceId, record) {
    const all = await readAll();
    all[indexKey(source, sourceId)] = { ...record, lastSyncedAt: new Date().toISOString() };
    await writeAll(all);
  }

  function hashPaper(p) {
    const seed = JSON.stringify({
      t: (p.title || '').trim().toLowerCase(),
      a: (p.abstract || '').trim().toLowerCase(),
      au: (p.authors || []).map(s => s.trim().toLowerCase()).sort(),
      d: (p.date || '').trim()
    });
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h.toString(16);
  }

  return { get, put, hashPaper };
}
