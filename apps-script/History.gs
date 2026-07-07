function apiGetHistory_(limit) {
  const sheet = ensureSheet_(getBook_(), KSB_API_CONFIG.SHEETS.HISTORY, ['Timestamp', 'Batch ID', 'User', 'Nickname', 'Layout', 'Label Count', 'Payload JSON']);
  const rows = readObjects_(sheet);
  const history = rows.map(function (row) {
    const payload = pick_(row, ['Payload JSON', 'Labels JSON', 'Payload']);
    let labels = [];
    try { labels = Array.isArray(payload) ? payload : JSON.parse(String(payload || '[]')); } catch (error) {}
    return {
      id: String(pick_(row, ['Batch ID', 'BatchId', 'ID']) || ''),
      timestamp: isoDate_(pick_(row, ['Timestamp', 'Date'])),
      user: String(pick_(row, ['User', 'Name']) || ''),
      nickname: String(pick_(row, ['Nickname']) || ''),
      layout: String(pick_(row, ['Layout']) || '3x2'),
      labels: labels
    };
  }).filter(function (batch) { return batch.id && batch.labels.length; })
    .sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); })
    .slice(0, Math.max(1, Math.min(limit || 500, 2000)));
  return { history: history };
}

function apiDeleteBatch_(batchId) {
  const id = clean_(batchId);
  if (!id) throw new Error('Batch ID is required.');
  const ss = getBook_();
  const deletedHistory = deleteRowsByValue_(ensureSheet_(ss, KSB_API_CONFIG.SHEETS.HISTORY, ['Timestamp', 'Batch ID', 'User', 'Nickname', 'Layout', 'Label Count', 'Payload JSON']), 'Batch ID', id);
  const deletedGeneration = deleteRowsByValue_(ensureSheet_(ss, KSB_API_CONFIG.SHEETS.GENERATION, ['Timestamp', 'Batch ID', 'User', 'Nickname', 'Layout', 'Label Count', 'Page Count']), 'Batch ID', id);
  return { deleted: deletedHistory + deletedGeneration };
}
