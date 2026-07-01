function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads') || SpreadsheetApp.getActiveSpreadsheet().insertSheet('Leads');
  var body = JSON.parse(e.postData.contents || '{}');

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['submittedAt', 'name', 'email', 'phone', 'interest', 'notes', 'source']);
  }

  sheet.appendRow([
    body.submittedAt || new Date().toISOString(),
    body.name || '',
    body.email || '',
    body.phone || '',
    body.interest || '',
    body.notes || '',
    body.source || ''
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
