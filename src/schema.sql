CREATE TABLE IF NOT EXISTS chat (
	id INTEGER PRIMARY KEY,
	chat_id INTEGER NOT NULL,
    UNIQUE (chat_id)
);

CREATE TABLE IF NOT EXISTS leetcode_daily_question (
	id INTEGER PRIMARY KEY,
	date TEXT NOT NULL,
	title TEXT NOT NULL,
	title_slug TEXT NOT NULL,
	question_id TEXT NOT NULL,
	difficulty TEXT NOT NULL,
	url TEXT NOT NULL,
	clist_rating INTEGER,
    UNIQUE (date)
);

CREATE TABLE IF NOT EXISTS chat_leetcode_usernames (
    id INTEGER PRIMARY KEY,
    chat_id INTEGER NOT NULL,
    leetcode_username TEXT NOT NULL,
    UNIQUE (chat_id, leetcode_username)
);

CREATE TABLE IF NOT EXISTS leetcode_daily_completion (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    leetcode_username TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    submission_url TEXT,
    UNIQUE (date, leetcode_username)
);

CREATE TABLE IF NOT EXISTS daily_question_sent (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    chat_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    message_text TEXT,
    reminder_sent INTEGER DEFAULT 0,
    UNIQUE (date, chat_id, message_id)
);

CREATE TABLE IF NOT EXISTS leetcode_user_streak (
    id INTEGER PRIMARY KEY,
    leetcode_username TEXT NOT NULL,
    current_streak INTEGER NOT NULL DEFAULT 0,
    max_streak INTEGER NOT NULL DEFAULT 0,
    last_completed_date TEXT,
    UNIQUE (leetcode_username)
);
