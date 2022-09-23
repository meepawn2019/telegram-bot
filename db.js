const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./login.db');

db.serialize(() => {
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id TEXT PRIMARY KEY,
      user_id INTERGER NOT NULL);`);
});

db.close();