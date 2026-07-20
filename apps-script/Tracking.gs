function shipmentStatusHeaders_() {
  return ['Tracking Key', 'Courier', 'AWB', 'Status', 'Updated At', 'Updated By'];
}

function normalizeShipmentStatus_(value) {
  const status = clean_(value).toLowerCase();
  if (status !== 'processing' && status !== 'delivered') throw new Error('Shipment status must be processing or delivered.');
  return status;
}

function normalizeShipmentAwb_(value) {
  return clean_(value).replace(/\s+/g, '').toUpperCase();
}

function apiGetShipmentStatuses_() {
  const sheet = ensureSheet_(getBook_(), KSB_API_CONFIG.SHEETS.SHIPMENTS, shipmentStatusHeaders_());
  const shipmentStatuses = readObjects_(sheet).map(function (row) {
    const courier = clean_(pick_(row, ['Courier'])).toUpperCase() || 'JNE';
    const awb = normalizeShipmentAwb_(pick_(row, ['AWB', 'Resi', 'Tracking Number']));
    const status = clean_(pick_(row, ['Status'])).toLowerCase();
    if (!awb || (status !== 'processing' && status !== 'delivered')) return null;
    return {
      key: courier + '|' + awb,
      courier: courier,
      awb: awb,
      status: status,
      updatedAt: isoDate_(pick_(row, ['Updated At', 'Timestamp'])),
      updatedBy: clean_(pick_(row, ['Updated By', 'User']))
    };
  }).filter(Boolean);
  return { shipmentStatuses: shipmentStatuses };
}

function apiSaveShipmentStatus_(payload) {
  const courier = clean_(payload && payload.courier).toUpperCase() || 'JNE';
  const awb = normalizeShipmentAwb_(payload && payload.awb);
  const status = normalizeShipmentStatus_(payload && payload.status);
  if (!awb) throw new Error('AWB is required.');

  const key = courier + '|' + awb;
  const updatedAt = parseDate_(payload && payload.updatedAt) || new Date();
  const updatedBy = clean_(payload && payload.updatedBy) || 'Local user';
  const sheet = ensureSheet_(getBook_(), KSB_API_CONFIG.SHEETS.SHIPMENTS, shipmentStatusHeaders_());
  const rowNumber = findRowByValue_(sheet, 'Tracking Key', key);
  const values = {
    'Tracking Key': key,
    'Courier': courier,
    'AWB': awb,
    'Status': status,
    'Updated At': updatedAt,
    'Updated By': updatedBy
  };

  if (!rowNumber) appendObject_(sheet, values);
  else {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(clean_);
    const current = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
    const currentUpdatedAt = parseDate_(current[headers.indexOf('Updated At')]);
    if (currentUpdatedAt && currentUpdatedAt.getTime() > updatedAt.getTime()) {
      return {
        shipmentStatus: {
          key: key,
          courier: courier,
          awb: awb,
          status: clean_(current[headers.indexOf('Status')]).toLowerCase(),
          updatedAt: currentUpdatedAt.toISOString(),
          updatedBy: clean_(current[headers.indexOf('Updated By')])
        },
        saved: false,
        updated: false,
        stale: true
      };
    }
    const next = headers.map(function (header, index) {
      return Object.prototype.hasOwnProperty.call(values, header) ? values[header] : current[index];
    });
    sheet.getRange(rowNumber, 1, 1, headers.length).setValues([next]);
  }

  return {
    shipmentStatus: {
      key: key,
      courier: courier,
      awb: awb,
      status: status,
      updatedAt: updatedAt.toISOString(),
      updatedBy: updatedBy
    },
    saved: !rowNumber,
    updated: !!rowNumber
  };
}
