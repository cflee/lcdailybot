CREATE TABLE IF NOT EXISTS chat (
	id INTEGER PRIMARY KEY,
	chat_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS leetcode_daily_question (
	id INTEGER PRIMARY KEY,
	date TEXT NOT NULL,
	title TEXT NOT NULL,
	title_slug TEXT NOT NULL,
	question_id TEXT NOT NULL,
	difficulty TEXT NOT NULL,
	url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_leetcode_usernames (
    id INTEGER PRIMARY KEY,
    chat_id INTEGER NOT NULL,
    leetcode_username TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leetcode_daily_completion (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    leetcode_username TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS daily_question_sent (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    chat_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL
);
