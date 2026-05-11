const SOURCE_PARENT_NAME = {
  'alphaxiv': 'AlphaXiv',
  'scholar-inbox': 'Scholar-Inbox'
};

export async function runSync({ source, adapter, apply, userPrefix }) {
  try {
    const adapterResult = await adapter.fetchAll();
    const sourceParentName = SOURCE_PARENT_NAME[source] || source;
    const result = await apply({ adapterResult, sourceParentName, userPrefix });
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, source, error: e.message };
  }
}
