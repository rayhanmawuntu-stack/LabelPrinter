/***************************************
 * KSB LabelPrint — Complete Code.gs
 * Use this for a NEW Google Sheet backend.
 ***************************************/

const CONFIG = {
  APP_NAME: 'KSB LabelPrint API',
  API_VERSION: '1.0.0',

  // For a bound script attached to a Google Sheet, leave this blank.
  // For standalone Apps Script, paste your Spreadsheet ID here.
  SPREADSHEET_ID: '',

  SHEETS: {
    USERS: 'Users',
    LOGIN: 'Login History',
    HISTORY: 'Label History',
    GENERATION: 'Generation Log'
  }
};

/**
 * Run this manually once before deploying.
 */
function setupLabelPrintSheets() {
  const ss = getBook_();

  ensureSheet_(ss, CONFIG.SHEETS.USERS, [
    'Timestamp',
    'Name',
    'Nickname',
    'Active'
  ]);

  ensureSheet_(ss, CONFIG.SHEETS.LOGIN, [
    'Timestamp',
    'Name',
    'Nickname',
    'Source',
    'User Agent'
  ]);

  ensureSheet_(ss, CONFIG.SHEETS.HISTORY, [
    'Timestamp',
    'Batch ID',
    'User',
    'Nickname',
    'Layout',
    'Label Count',
    'Payload JSON'
  ]);

  ensureSheet_(ss, CONFIG.SHEETS.GENERATION, [
    'Timestamp',
    'Batch ID',
    'User',
    'Nickname',
    'Layout',
    'Label Count',
    'Page Count'
  ]);

  seedDefaultUser_();

  return 'KSB LabelPrint backend is ready.';
}

/**
 * GET API.
 * Supports JSON and JSONP.
 */
function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = clean_(params.action || 'ping');
  const callback = clean_(params.callback || '');

  try {
    let result;

    switch (action) {
      case 'ping':
        result = apiPing_();
        break;

      case 'getUsers':
        result = apiGetUsers_();
        break;

      case 'getHistory':
        result = apiGetHistory_(Number(params.limit || 500));
        break;

      default:
        throw new Error('Unknown GET action: ' + action);
    }

    return output_(Object.assign({ success: true }, result), callback);
  } catch (error) {
    return output_({
      success: false,
      message: error.message,
      stack: String(error.stack || '')
    }, callback);
  }
}

/**
 * POST API.
 * Frontend sends URLSearchParams:
 * action=saveBatch&payload={...}
 */
function doPost(e) {
  const params = (e && e.parameter) || {};
  const action = clean_(params.action || '');

  let payload = {};
  try {
    if (params.payload) {
      payload = JSON.parse(params.payload);
    } else if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }
  } catch (error) {
    payload = {};
  }

  try {
    let result;

    switch (action) {
      case 'addUser':
        result = withLock_(function () {
          return apiAddUser_(payload);
        });
        break;

      case 'logLogin':
        result = withLock_(function () {
          return apiLogLogin_(payload);
        });
        break;

      case 'saveBatch':
        result = withLock_(function () {
          return apiSaveBatch_(payload);
        });
        break;

      case 'deleteBatch':
        result = withLock_(function () {
          return apiDeleteBatch_(payload.id);
        });
        break;

      default:
        throw new Error('Unknown POST action: ' + action);
    }

    return output_(Object.assign({ success: true }, result));
  } catch (error) {
    return output_({
      success: false,
      message: error.message,
      stack: String(error.stack || '')
    });
  }
}

/* =========================
   API IMPLEMENTATION
========================= */

function apiPing_() {
  const ss = getBook_();

  setupIfMissing_();

  return {
    apiVersion: CONFIG.API_VERSION,
    appName: CONFIG.APP_NAME,
    spreadsheetName: ss.getName(),
    spreadsheetId: ss.getId(),
    timestamp: new Date().toISOString()
  };
}

function apiGetUsers_() {
  setupIfMissing_();

  const sheet = getBook_().getSheetByName(CONFIG.SHEETS.USERS);
  const rows = readObjects_(sheet);

  const seen = {};
  const users = [];

  rows.forEach(function (row) {
    const name = clean_(pick_(row, ['Name', 'Full Name', 'User']));
    const nickname = clean_(pick_(row, ['Nickname', 'Nick Name'])) || firstName_(name);
    const active = normalizeBoolean_(pick_(row, ['Active', 'Is Active']), true);

    if (!name || !active) return;

    const key = name.toLowerCase();
    if (seen[key]) return;

    seen[key] = true;
    users.push({
      name: name,
      nickname: nickname,
      active: true
    });
  });

  if (!users.length) {
    users.push({
      name: 'Rayhan Ardhana',
      nickname: 'Rayhan',
      active: true
    });
  }

  return { users: users };
}

function apiAddUser_(payload) {
  setupIfMissing_();

  const name = clean_(payload.name);
  const nickname = clean_(payload.nickname) || firstName_(name);

  if (!name) throw new Error('User name is required.');

  const sheet = getBook_().getSheetByName(CONFIG.SHEETS.USERS);
  const existing = apiGetUsers_().users.some(function (user) {
    return user.name.toLowerCase() === name.toLowerCase();
  });

  if (!existing) {
    appendObject_(sheet, {
      'Timestamp': new Date(),
      'Name': name,
      'Nickname': nickname,
      'Active': true
    });
  }

  return {
    created: !existing,
    user: {
      name: name,
      nickname: nickname,
      active: true
    }
  };
}

function apiLogLogin_(payload) {
  setupIfMissing_();

  const sheet = getBook_().getSheetByName(CONFIG.SHEETS.LOGIN);

  appendObject_(sheet, {
    'Timestamp': new Date(),
    'Name': clean_(payload.name),
    'Nickname': clean_(payload.nickname),
    'Source': clean_(payload.source) || 'github-pages',
    'User Agent': clean_(payload.userAgent)
  });

  return { logged: true };
}

function apiGetHistory_(limit) {
  setupIfMissing_();

  const sheet = getBook_().getSheetByName(CONFIG.SHEETS.HISTORY);
  const rows = readObjects_(sheet);

  const history = rows.map(function (row) {
    const rawPayload = pick_(row, [
      'Payload JSON',
      'Labels JSON',
      'Payload'
    ]);

    let labels = [];
    try {
      labels = JSON.parse(String(rawPayload || '[]'));
    } catch (error) {
      labels = [];
    }

    return {
      id: clean_(pick_(row, ['Batch ID', 'BatchId', 'ID'])),
      timestamp: isoDate_(pick_(row, ['Timestamp', 'Date'])),
      user: clean_(pick_(row, ['User', 'Name'])),
      nickname: clean_(pick_(row, ['Nickname'])),
      layout: clean_(pick_(row, ['Layout'])) || '3x2',
      labels: Array.isArray(labels) ? labels : []
    };
  }).filter(function (batch) {
    return batch.id && batch.labels.length;
  }).sort(function (a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  const max = Math.max(1, Math.min(Number(limit || 500), 2000));

  return {
    history: history.slice(0, max)
  };
}

function apiSaveBatch_(payload) {
  setupIfMissing_();

  const labels = Array.isArray(payload.labels) ? payload.labels : [];

  if (!payload.id) throw new Error('Batch ID is required.');
  if (!labels.length) throw new Error('At least one label is required.');

  const ss = getBook_();
  const historySheet = ss.getSheetByName(CONFIG.SHEETS.HISTORY);
  const generationSheet = ss.getSheetByName(CONFIG.SHEETS.GENERATION);

  const batchId = String(payload.id);
  const existingRow = findRowByValue_(historySheet, 'Batch ID', batchId);

  const timestamp = parseDate_(payload.timestamp) || new Date();
  const layout = clean_(payload.layout) || '3x2';
  const user = clean_(payload.user);
  const nickname = clean_(payload.nickname);

  if (!existingRow) {
    appendObject_(historySheet, {
      'Timestamp': timestamp,
      'Batch ID': batchId,
      'User': user,
      'Nickname': nickname,
      'Layout': layout,
      'Label Count': labels.length,
      'Payload JSON': JSON.stringify(labels)
    });

    appendObject_(generationSheet, {
      'Timestamp': timestamp,
      'Batch ID': batchId,
      'User': user,
      'Nickname': nickname,
      'Layout': layout,
      'Label Count': labels.length,
      'Page Count': pageCount_(labels.length, layout)
    });
  }

  return {
    batchId: batchId,
    saved: !existingRow,
    duplicate: !!existingRow
  };
}

function apiDeleteBatch_(batchId) {
  setupIfMissing_();

  const id = clean_(batchId);
  if (!id) throw new Error('Batch ID is required.');

  const ss = getBook_();

  const deletedHistory = deleteRowsByValue_(
    ss.getSheetByName(CONFIG.SHEETS.HISTORY),
    'Batch ID',
    id
  );

  const deletedGeneration = deleteRowsByValue_(
    ss.getSheetByName(CONFIG.SHEETS.GENERATION),
    'Batch ID',
    id
  );

  return {
    deleted: deletedHistory + deletedGeneration
  };
}

/* =========================
   SETUP + SHEET HELPERS
========================= */

function setupIfMissing_() {
  const ss = getBook_();

  ensureSheet_(ss, CONFIG.SHEETS.USERS, [
    'Timestamp',
    'Name',
    'Nickname',
    'Active'
  ]);

  ensureSheet_(ss, CONFIG.SHEETS.LOGIN, [
    'Timestamp',
    'Name',
    'Nickname',
    'Source',
    'User Agent'
  ]);

  ensureSheet_(ss, CONFIG.SHEETS.HISTORY, [
    'Timestamp',
    'Batch ID',
    'User',
    'Nickname',
    'Layout',
    'Label Count',
    'Payload JSON'
  ]);

  ensureSheet_(ss, CONFIG.SHEETS.GENERATION, [
    'Timestamp',
    'Batch ID',
    'User',
    'Nickname',
    'Layout',
    'Label Count',
    'Page Count'
  ]);

  seedDefaultUser_();
}

function seedDefaultUser_() {
  const sheet = getBook_().getSheetByName(CONFIG.SHEETS.USERS);
  const users = readObjects_(sheet);

  const hasRayhan = users.some(function (row) {
    return clean_(row.Name).toLowerCase() === 'rayhan ardhana';
  });

  if (!hasRayhan) {
    appendObject_(sheet, {
      'Timestamp': new Date(),
      'Name': 'Rayhan Ardhana',
      'Nickname': 'Rayhan',
      'Active': true
    });
  }
}

function getBook_() {
  if (CONFIG.SPREADSHEET_ID) {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error(
      'No active spreadsheet found. Bind this script to a Google Sheet or set CONFIG.SPREADSHEET_ID.'
    );
  }

  return active;
}

function ensureSheet_(ss, name, requiredHeaders) {
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  ensureHeaders_(sheet, requiredHeaders);
  return sheet;
}

function ensureHeaders_(sheet, requiredHeaders) {
  const lastColumn = Math.max(sheet.getLastColumn(), requiredHeaders.length, 1);
  const hasRows = sheet.getLastRow() > 0;

  let headers = hasRows
    ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(clean_)
    : [];

  if (!headers.some(Boolean)) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    sheet.setFrozenRows(1);
    return requiredHeaders;
  }

  const missing = requiredHeaders.filter(function (header) {
    return headers.indexOf(header) === -1;
  });

  if (missing.length) {
    sheet
      .getRange(1, headers.length + 1, 1, missing.length)
      .setValues([missing]);
    headers = headers.concat(missing);
  }

  sheet.setFrozenRows(1);
  return headers;
}

function appendObject_(sheet, object) {
  const headers = ensureHeaders_(sheet, Object.keys(object));
  const row = headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(object, header)
      ? object[header]
      : '';
  });

  sheet.appendRow(row);
}

function readObjects_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2 || lastColumn < 1) return [];

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values.shift().map(clean_);

  return values
    .filter(function (row) {
      return row.some(function (cell) {
        return cell !== '';
      });
    })
    .map(function (row) {
      const object = {};
      headers.forEach(function (header, index) {
        if (header) object[header] = row[index];
      });
      return object;
    });
}

function findRowByValue_(sheet, header, value) {
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(clean_);

  const columnIndex = headers.indexOf(header) + 1;

  if (!columnIndex || sheet.getLastRow() < 2) return 0;

  const found = sheet
    .getRange(2, columnIndex, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(value))
    .matchEntireCell(true)
    .findNext();

  return found ? found.getRow() : 0;
}

function deleteRowsByValue_(sheet, header, value) {
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(clean_);

  const columnIndex = headers.indexOf(header) + 1;

  if (!columnIndex || sheet.getLastRow() < 2) return 0;

  const values = sheet
    .getRange(2, columnIndex, sheet.getLastRow() - 1, 1)
    .getDisplayValues();

  let deleted = 0;

  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]) === String(value)) {
      sheet.deleteRow(i + 2);
      deleted++;
    }
  }

  return deleted;
}

/* =========================
   UTILITIES
========================= */

function withLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function output_(payload, callback) {
  const json = JSON.stringify(payload);
  const cb = clean_(callback);

  if (cb && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(cb)) {
    return ContentService
      .createTextOutput(cb + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function pick_(object, keys) {
  for (let i = 0; i < keys.length; i++) {
    if (
      Object.prototype.hasOwnProperty.call(object, keys[i]) &&
      object[keys[i]] !== ''
    ) {
      return object[keys[i]];
    }
  }

  return '';
}

function clean_(value) {
  return value === null || value === undefined
    ? ''
    : String(value).trim();
}

function firstName_(name) {
  return clean_(name).split(/\s+/)[0] || 'User';
}

function normalizeBoolean_(value, fallback) {
  if (value === '' || value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'boolean') return value;

  return !/^(false|0|no|inactive)$/i.test(String(value).trim());
}

function parseDate_(value) {
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function isoDate_(value) {
  const date = parseDate_(value) || new Date();
  return date.toISOString();
}

function pageCount_(count, layout) {
  const capacity = {
    '3x3': 9,
    '3x2': 6,
    '2x2': 4,
    '2x1': 2,
    '1x1': 1
  }[layout] || 6;

  return Math.max(1, Math.ceil(Number(count || 0) / capacity));
}
