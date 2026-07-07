function findRowByValue_(sheet, header, value) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(clean_);
  const column = headers.indexOf(header) + 1;
  if (!column || sheet.getLastRow() < 2) return 0;
  const finder = sheet.getRange(2, column, sheet.getLastRow() - 1, 1).createTextFinder(String(value)).matchEntireCell(true).findNext();
  return finder ? finder.getRow() : 0;
}
function deleteRowsByValue_(sheet, header, value) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(clean_);
  const column = headers.indexOf(header) + 1;
  if (!column || sheet.getLastRow() < 2) return 0;
  const values = sheet.getRange(2, column, sheet.getLastRow() - 1, 1).getDisplayValues();
  let deleted = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]) === String(value)) { sheet.deleteRow(i + 2); deleted++; }
  }
  return deleted;
}
function pick_(object, keys) {
  for (let i = 0; i < keys.length; i++) if (object.hasOwnProperty(keys[i]) && object[keys[i]] !== '') return object[keys[i]];
  return '';
}
function clean_(value) { return value === null || value === undefined ? '' : String(value).trim(); }
function normalizeBoolean_(value, fallback) {
  if (value === '' || value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  return !/^(false|0|no|inactive)$/i.test(String(value).trim());
}
function parseDate_(value) { const date = value instanceof Date ? value : new Date(value); return isNaN(date.getTime()) ? null : date; }
function isoDate_(value) { const date = parseDate_(value) || new Date(); return date.toISOString(); }
function pageCount_(count, layout) { const capacity = { '3x3': 9, '3x2': 6, '2x2': 4, '2x1': 2, '1x1': 1 }[layout] || 6; return Math.max(1, Math.ceil(count / capacity)); }
function jsonOutput_(payload, callback) {
  const json = JSON.stringify(payload);
  const cb = clean_(callback);
  if (cb && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
