function apiSaveBatch_(payload) {
  const labels = Array.isArray(payload.labels) ? payload.labels : [];
  if (!payload.id) throw new Error('Batch ID is required.');
  if (!labels.length) throw new Error('At least one label is required.');
  const ss = getBook_();
  const history = ensureSheet_(ss, KSB_API_CONFIG.SHEETS.HISTORY, ['Timestamp', 'Batch ID', 'User', 'Nickname', 'Layout', 'Label Count', 'Payload JSON']);
  const generation = ensureSheet_(ss, KSB_API_CONFIG.SHEETS.GENERATION, ['Timestamp', 'Batch ID', 'User', 'Nickname', 'Layout', 'Label Count', 'Page Count']);
  const existing = findRowByValue_(history, 'Batch ID', String(payload.id));
  if (!existing) {
    appendObject_(history, {
      'Timestamp': parseDate_(payload.timestamp) || new Date(),
      'Batch ID': String(payload.id),
      'User': clean_(payload.user),
      'Nickname': clean_(payload.nickname),
      'Layout': clean_(payload.layout) || '3x2',
      'Label Count': labels.length,
      'Payload JSON': JSON.stringify(labels)
    });
    appendObject_(generation, {
      'Timestamp': parseDate_(payload.timestamp) || new Date(),
      'Batch ID': String(payload.id),
      'User': clean_(payload.user),
      'Nickname': clean_(payload.nickname),
      'Layout': clean_(payload.layout) || '3x2',
      'Label Count': labels.length,
      'Page Count': pageCount_(labels.length, clean_(payload.layout) || '3x2')
    });
  }
  return { batchId: String(payload.id), saved: !existing, duplicate: !!existing };
}
