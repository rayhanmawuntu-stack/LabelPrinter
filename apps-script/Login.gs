function apiLogLogin_(payload) {
  const sheet = ensureSheet_(getBook_(), KSB_API_CONFIG.SHEETS.LOGIN, ['Timestamp', 'Name', 'Nickname', 'Source', 'User Agent']);
  appendObject_(sheet, {
    'Timestamp': new Date(),
    'Name': clean_(payload.name),
    'Nickname': clean_(payload.nickname),
    'Source': clean_(payload.source) || 'github-pages',
    'User Agent': clean_(payload.userAgent)
  });
  return { logged: true };
}
