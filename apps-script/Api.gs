/**
 * KSB LabelPrint Google Sheets API
 * Deploy as a Web App: Execute as Me, access Anyone.
 * The GitHub Pages frontend uses JSONP for reads and form POSTs for writes.
 */
const KSB_API_CONFIG = Object.freeze({
  SPREADSHEET_ID: '1lRyEvOa7MKMdOLoXIcAErVVgBU9MUP-g-x7aGaB--MY',
  API_VERSION: '1.1.0',
  SHEETS: {
    USERS: 'Users',
    LOGIN: 'Login History',
    HISTORY: 'Label History',
    GENERATION: 'Generation Log',
    SHIPMENTS: 'Shipment Status'
  }
});

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = String(params.action || '').trim();
  if (!action) {
    try {
      return HtmlService.createHtmlOutputFromFile('Index')
        .setTitle('KSB LabelPrint')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (error) {
      return jsonOutput_({ success: true, message: 'KSB LabelPrint API is running.', apiVersion: KSB_API_CONFIG.API_VERSION }, params.callback);
    }
  }
  try {
    let result;
    switch (action) {
      case 'ping': result = apiPing_(); break;
      case 'getUsers': result = apiGetUsers_(); break;
      case 'getHistory': result = apiGetHistory_(Number(params.limit) || 500); break;
      case 'getShipmentStatuses': result = apiGetShipmentStatuses_(); break;
      default: throw new Error('Unknown GET action: ' + action);
    }
    return jsonOutput_(Object.assign({ success: true }, result || {}), params.callback);
  } catch (error) {
    return jsonOutput_({ success: false, message: error.message, stack: String(error.stack || '') }, params.callback);
  }
}

function doPost(e) {
  const params = (e && e.parameter) || {};
  let parsedBody = {};
  try {
    const raw = e && e.postData && e.postData.contents;
    if (raw && String(e.postData.type || '').indexOf('application/json') >= 0) parsedBody = JSON.parse(raw);
  } catch (error) {}
  const action = String(params.action || parsedBody.action || '').trim();
  let payload = params.payload || parsedBody.payload || parsedBody || {};
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch (error) { payload = {}; }
  }
  try {
    let result;
    switch (action) {
      case 'addUser': result = withScriptLock_(function () { return apiAddUser_(payload); }); break;
      case 'logLogin': result = withScriptLock_(function () { return apiLogLogin_(payload); }); break;
      case 'saveBatch': result = withScriptLock_(function () { return apiSaveBatch_(payload); }); break;
      case 'deleteBatch': result = withScriptLock_(function () { return apiDeleteBatch_(payload.id); }); break;
      case 'saveShipmentStatus': result = withScriptLock_(function () { return apiSaveShipmentStatus_(payload); }); break;
      default: throw new Error('Unknown POST action: ' + action);
    }
    return jsonOutput_(Object.assign({ success: true }, result || {}));
  } catch (error) {
    return jsonOutput_({ success: false, message: error.message, stack: String(error.stack || '') });
  }
}
