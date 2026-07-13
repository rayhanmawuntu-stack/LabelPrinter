function writeBatchObject_(sheet, rowNumber, values) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(clean_);
  if (!rowNumber) {
    appendObject_(sheet, values);
    return;
  }
  const current = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  const next = headers.map(function (header, index) {
    return Object.prototype.hasOwnProperty.call(values, header) ? values[header] : current[index];
  });
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([next]);
}

function apiSaveBatch_(payload) {
  const labels = Array.isArray(payload.labels) ? payload.labels : [];
  if (!payload.id) throw new Error('Batch ID is required.');
  if (!labels.length) throw new Error('At least one label is required.');
  const ss = getBook_();
  const history = ensureSheet_(ss, KSB_API_CONFIG.SHEETS.HISTORY, ['Timestamp', 'Batch ID', 'User', 'Nickname', 'Layout', 'Label Count', 'Payload JSON']);
  const generation = ensureSheet_(ss, KSB_API_CONFIG.SHEETS.GENERATION, ['Timestamp', 'Batch ID', 'User', 'Nickname', 'Layout', 'Label Count', 'Page Count']);
  const batchId = String(payload.id);
  const timestamp = parseDate_(payload.timestamp) || new Date();
  const layout = clean_(payload.layout) || '3x2';
  const historyRow = findRowByValue_(history, 'Batch ID', batchId);
  const generationRow = findRowByValue_(generation, 'Batch ID', batchId);

  writeBatchObject_(history, historyRow, {
    'Timestamp': timestamp,
    'Batch ID': batchId,
    'User': clean_(payload.user),
    'Nickname': clean_(payload.nickname),
    'Layout': layout,
    'Label Count': labels.length,
    'Payload JSON': JSON.stringify(labels)
  });
  writeBatchObject_(generation, generationRow, {
    'Timestamp': timestamp,
    'Batch ID': batchId,
    'User': clean_(payload.user),
    'Nickname': clean_(payload.nickname),
    'Layout': layout,
    'Label Count': labels.length,
    'Page Count': pageCount_(labels.length, layout)
  });

  return { batchId: batchId, saved: !historyRow, updated: !!historyRow, duplicate: false };
}