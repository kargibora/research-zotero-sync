import { SOURCES } from '../sources/registry.js';

export async function runSync({ source, adapter, apply, userPrefix }) {
  try {
    const adapterResult = await adapter.fetchAll();
    const sourceParentName = SOURCES[source]?.parentName || source;
    const result = await apply({ adapterResult, sourceParentName, userPrefix });
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, source, error: e.message };
  }
}
