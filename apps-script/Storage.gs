function getBook_() { return SpreadsheetApp.openById(KSB_API_CONFIG.SPREADSHEET_ID); }
function withScriptLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return callback(); } finally { lock.releaseLock(); }
}
function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  ensureHeaders_(sheet, headers);
  return sheet;
}
function ensureHeaders_(sheet, required) {
  const width = Math.max(sheet.getLastColumn(), required.length, 1);
  let current = sheet.getLastRow() ? sheet.getRange(1, 1, 1, width).getValues()[0].map(clean_) : [];
  if (!current.some(Boolean)) {
    sheet.getRange(1, 1, 1, required.length).setValues([required]);
    sheet.setFrozenRows(1);
    return required;
  }
  const missing = required.filter(function (header) { return current.indexOf(header) < 0; });
  if (missing.length) {
    const start = current.length + 1;
    sheet.getRange(1, start, 1, missing.length).setValues([missing]);
    current = current.concat(missing);
  }
  sheet.setFrozenRows(1);
  return current;
}
function appendObject_(sheet, object) {
  const headers = ensureHeaders_(sheet, Object.keys(object));
  sheet.appendRow(headers.map(function (header) { return object.hasOwnProperty(header) ? object[header] : ''; }));
}
function readObjects_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return [];
  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values.shift().map(clean_);
  return values.filter(function (row) { return row.some(function (cell) { return cell !== ''; }); }).map(function (row) {
    const object = {};
    headers.forEach(function (header, index) { if (header) object[header] = row[index]; });
    return object;
  });
}
