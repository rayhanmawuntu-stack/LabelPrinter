function apiGetUsers_() {
  const sheet = ensureSheet_(getBook_(), KSB_API_CONFIG.SHEETS.USERS, ['Timestamp', 'Name', 'Nickname', 'Active']);
  const rows = readObjects_(sheet);
  const seen = {};
  const users = rows.map(function (row) {
    return {
      name: pick_(row, ['Name', 'Full Name', 'User']) || '',
      nickname: pick_(row, ['Nickname', 'Nick Name']) || '',
      active: normalizeBoolean_(pick_(row, ['Active', 'Is Active']), true)
    };
  }).filter(function (user) {
    const key = user.name.toLowerCase();
    if (!user.name || !user.active || seen[key]) return false;
    seen[key] = true;
    if (!user.nickname) user.nickname = user.name.split(/\s+/)[0];
    return true;
  });
  if (!users.length) users.push({ name: 'Rayhan Ardhana', nickname: 'Rayhan', active: true });
  return { users: users };
}

function apiAddUser_(payload) {
  const name = clean_(payload.name);
  const nickname = clean_(payload.nickname) || name.split(/\s+/)[0];
  if (!name) throw new Error('A user name is required.');
  const sheet = ensureSheet_(getBook_(), KSB_API_CONFIG.SHEETS.USERS, ['Timestamp', 'Name', 'Nickname', 'Active']);
  const existing = apiGetUsers_().users.some(function (user) { return user.name.toLowerCase() === name.toLowerCase(); });
  if (!existing) appendObject_(sheet, { 'Timestamp': new Date(), 'Name': name, 'Nickname': nickname, 'Active': true });
  return { user: { name: name, nickname: nickname, active: true }, created: !existing };
}
