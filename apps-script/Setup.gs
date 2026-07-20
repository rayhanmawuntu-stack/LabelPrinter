function setupLabelPrintSheets() {
  const ss = getBook_();
  ensureSheet_(ss, KSB_API_CONFIG.SHEETS.USERS, ['Timestamp', 'Name', 'Nickname', 'Active']);
  ensureSheet_(ss, KSB_API_CONFIG.SHEETS.LOGIN, ['Timestamp', 'Name', 'Nickname', 'Source', 'User Agent']);
  ensureSheet_(ss, KSB_API_CONFIG.SHEETS.HISTORY, ['Timestamp', 'Batch ID', 'User', 'Nickname', 'Layout', 'Label Count', 'Payload JSON']);
  ensureSheet_(ss, KSB_API_CONFIG.SHEETS.GENERATION, ['Timestamp', 'Batch ID', 'User', 'Nickname', 'Layout', 'Label Count', 'Page Count']);
  ensureSheet_(ss, KSB_API_CONFIG.SHEETS.SHIPMENTS, ['Tracking Key', 'Courier', 'AWB', 'Status', 'Updated At', 'Updated By']);
  return 'KSB LabelPrint sheets are ready.';
}

function apiPing_() {
  const ss = getBook_();
  return { apiVersion: KSB_API_CONFIG.API_VERSION, spreadsheetName: ss.getName(), timestamp: new Date().toISOString() };
}
