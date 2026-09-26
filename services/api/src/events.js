
const clients = new Map();

export function addClient(parentId, res) {
  if (!clients.has(parentId)) clients.set(parentId, new Set());
  clients.get(parentId).add(res);
  res.on("close", () => clients.get(parentId)?.delete(res));
}

export function broadcast(parentId, event, payload) {
  const set = clients.get(parentId);
  if (!set) return;
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try { res.write(data); } catch { set.delete(res); }
  }
}
