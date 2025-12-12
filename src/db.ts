import { getPreviousDate } from "./leetcode";

export async function checkSubscriber(
	DB: D1Database,
	chatId: number,
): Promise<boolean> {
	try {
		const existingRecords = await DB.prepare(
			"SELECT * FROM chat WHERE chat_id = ?",
		)
			.bind(chatId)
			.all();

		return existingRecords.results.length > 0;
	} catch (error) {
		console.error("Error checking subscriber:", error);
		return false;
	}
}

export async function insertSubscriber(
	DB: D1Database,
	chatId: number,
): Promise<boolean> {
	try {
		const result = await DB.prepare("INSERT INTO chat (chat_id) VALUES (?)")
			.bind(chatId)
			.run();

		return result.success;
	} catch (error) {
		console.error("Error inserting subscriber:", error);
		return false;
	}
}

export async function deleteSubscriber(
	DB: D1Database,
	chatId: number,
): Promise<boolean> {
	try {
		const result = await DB.prepare("DELETE FROM chat WHERE chat_id = ?")
			.bind(chatId)
			.run();

		return result.success;
	} catch (error) {
		console.error("Error deleting subscriber:", error);
		return false;
	}
}

export async function addLeetcodeUsername(
	DB: D1Database,
	chatId: number,
	username: string,
): Promise<boolean> {
	try {
		const result = await DB.prepare(
			"INSERT INTO chat_leetcode_usernames (chat_id, leetcode_username) VALUES (?, ?)",
		)
			.bind(chatId, username)
			.run();
		return result.success;
	} catch (error: unknown) {
		if (
			typeof error === "object" &&
			error !== null &&
			"message" in error &&
			typeof (error as Record<string, unknown>).message === "string" &&
			(error as { message: string }).message.includes("UNIQUE")
		) {
			// Already exists, treat as success
			return true;
		}
		console.error("Error adding leetcode username:", error);
		return false;
	}
}

export async function removeLeetcodeUsername(
	DB: D1Database,
	chatId: number,
	username: string,
): Promise<boolean> {
	try {
		const result = await DB.prepare(
			"DELETE FROM chat_leetcode_usernames WHERE chat_id = ? AND leetcode_username = ?",
		)
			.bind(chatId, username)
			.run();
		return result.success;
	} catch (error) {
		console.error("Error removing leetcode username:", error);
		return false;
	}
}

export interface LcDailyProblem {
	date: string;
	questionTitle: string;
	questionTitleSlug: string;
	questionId: string;
	questionDifficulty: string;
	url: string;
	clistRating: number | null;
}

export async function getDailyQuestion(
	DB: D1Database,
	date: string,
): Promise<LcDailyProblem | null> {
	try {
		const dbResult = await DB.prepare(
			"SELECT date, title, title_slug, question_id, difficulty, url, clist_rating FROM leetcode_daily_question WHERE date = ?",
		)
			.bind(date)
			.run();

		if (dbResult.results.length > 0) {
			return {
				date: dbResult.results[0].date as string,
				questionTitle: dbResult.results[0].title as string,
				questionTitleSlug: dbResult.results[0].title_slug as string,
				questionId: dbResult.results[0].question_id as string,
				questionDifficulty: dbResult.results[0].difficulty as string,
				url: dbResult.results[0].url as string,
				clistRating: dbResult.results[0].clist_rating as number | null,
			};
		}
		return null;
	} catch (error) {
		console.error("Error getting daily question:", error);
		return null;
	}
}

export async function insertDailyQuestion(
	DB: D1Database,
	data: LcDailyProblem,
): Promise<boolean> {
	try {
		const result = await DB.prepare(
			"INSERT INTO leetcode_daily_question (date, title, title_slug, question_id, difficulty, url, clist_rating) VALUES (?, ?, ?, ?, ?, ?, ?)",
		)
			.bind(
				data.date,
				data.questionTitle,
				data.questionTitleSlug,
				data.questionId,
				data.questionDifficulty,
				data.url,
				data.clistRating ?? null,
			)
			.run();

		return result.success;
	} catch (error) {
		console.error("Error inserting daily question:", error);
		return false;
	}
}

// Get all chat IDs
export async function getAllChats(DB: D1Database): Promise<number[]> {
	try {
		const result = await DB.prepare("SELECT chat_id FROM chat").all();
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		return result.results.map((row: any) => row.chat_id);
	} catch (error) {
		console.error("Error fetching all chats:", error);
		return [];
	}
}

// Get all leetcode usernames for all chats
export async function getAllLeetcodeUsernames(
	DB: D1Database,
): Promise<string[]> {
	try {
		const result = await DB.prepare(
			"SELECT DISTINCT leetcode_username FROM chat_leetcode_usernames",
		).all();
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		return result.results.map((row: any) => row.leetcode_username);
	} catch (error) {
		console.error("Error fetching all leetcode usernames:", error);
		return [];
	}
}

// Get leetcode usernames for a specific chat
export async function getLeetcodeUsernamesForChat(
	DB: D1Database,
	chatId: number,
): Promise<string[]> {
	try {
		const result = await DB.prepare(
			"SELECT leetcode_username FROM chat_leetcode_usernames WHERE chat_id = ?",
		)
			.bind(chatId)
			.all();
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		return result.results.map((row: any) => row.leetcode_username);
	} catch (error) {
		console.error("Error fetching leetcode usernames for chat:", error);
		return [];
	}
}

export interface LcDailyCompletion {
	date: string;
	leetcodeUsername: string;
	completed: boolean;
	submissionUrl: string | null;
}

export async function getCompletionStatus(
	DB: D1Database,
	date: string,
	leetcodeUsername: string,
): Promise<LcDailyCompletion | null> {
	try {
		const dbResult = await DB.prepare(
			"SELECT completed, submission_url FROM leetcode_daily_completion WHERE date = ? AND leetcode_username = ?",
		)
			.bind(date, leetcodeUsername)
			.all();
		if (dbResult.results.length > 0) {
			return {
				date,
				leetcodeUsername,
				completed: !!dbResult.results[0].completed,
				submissionUrl: dbResult.results[0].submission_url as string | null,
			};
		}
		return null;
	} catch (error) {
		console.error("Error fetching completion status:", error);
		return null;
	}
}

export async function setCompletionStatus(
	DB: D1Database,
	date: string,
	leetcodeUsername: string,
	completed: boolean,
	submissionUrl: string | null,
): Promise<void> {
	try {
		await DB.prepare(
			`INSERT INTO leetcode_daily_completion (date, leetcode_username, completed, submission_url)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(date, leetcode_username) DO UPDATE SET completed = excluded.completed, submission_url = excluded.submission_url`,
		)
			.bind(date, leetcodeUsername, completed ? 1 : 0, submissionUrl)
			.run();
	} catch (error) {
		console.error("Error setting completion status:", error);
	}
}

// Get sent message info for chat/date
export async function getDailyMessageSent(
	DB: D1Database,
	date: string,
	chatId: number,
): Promise<{ messageId: number; messageText: string } | null> {
	try {
		const result = await DB.prepare(
			"SELECT message_id, message_text FROM daily_question_sent WHERE date = ? AND chat_id = ?",
		)
			.bind(date, chatId)
			.first();
		return result
			? {
					messageId: Number(result.message_id),
					messageText: result.message_text as string,
				}
			: null;
	} catch (error) {
		console.error("Error fetching daily message sent:", error);
		return null;
	}
}

// Set sent message info for chat/date
export async function setDailyMessageSent(
	DB: D1Database,
	date: string,
	chatId: number,
	messageId: number,
	messageText: string,
): Promise<boolean> {
	try {
		const result = await DB.prepare(
			"INSERT INTO daily_question_sent (date, chat_id, message_id, message_text) VALUES (?, ?, ?, ?) " +
				"ON CONFLICT (date, chat_id, message_id) DO UPDATE SET message_text = ?",
		)
			.bind(date, chatId, messageId, messageText, messageText)
			.run();
		return result.success;
	} catch (error) {
		console.error("Error setting daily message sent:", error);
		return false;
	}
}

// Get the most recent daily message sent for a chat (before a given date)
export async function getLastDailyMessageSent(
	DB: D1Database,
	chatId: number,
	beforeDate: string,
): Promise<{ date: string; messageId: number; messageText: string } | null> {
	try {
		const result = await DB.prepare(
			"SELECT date, message_id, message_text FROM daily_question_sent WHERE chat_id = ? AND date < ? ORDER BY date DESC LIMIT 1",
		)
			.bind(chatId, beforeDate)
			.first();
		if (result) {
			return {
				date: result.date as string,
				messageId: Number(result.message_id),
				messageText: result.message_text as string,
			};
		}
		return null;
	} catch (error) {
		console.error("Error getting last daily message sent:", error);
		return null;
	}
}

export interface UserStreak {
	leetcodeUsername: string;
	currentStreak: number;
	maxStreak: number;
	lastCompletedDate: string | null;
}

export async function getUserStreak(
	DB: D1Database,
	leetcodeUsername: string,
	todayDate?: string,
): Promise<UserStreak | null> {
	try {
		const result = await DB.prepare(
			"SELECT current_streak, max_streak, last_completed_date FROM leetcode_user_streak WHERE leetcode_username = ?",
		)
			.bind(leetcodeUsername)
			.first();

		if (result) {
			const streak = {
				leetcodeUsername,
				currentStreak: Number(result.current_streak),
				maxStreak: Number(result.max_streak),
				lastCompletedDate: result.last_completed_date as string | null,
			};

			if (todayDate && streak.lastCompletedDate) {
				const yesterday = getPreviousDate(todayDate);
				// If last completed date is neither today nor yesterday, effective streak is 0
				if (
					streak.lastCompletedDate !== todayDate &&
					streak.lastCompletedDate !== yesterday
				) {
					streak.currentStreak = 0;
				}
			}

			return streak;
		}
		return null;
	} catch (error) {
		console.error("Error getting user streak:", error);
		return null;
	}
}

export async function updateUserStreak(
	DB: D1Database,
	leetcodeUsername: string,
	date: string,
): Promise<void> {
	try {
		// Get current streak info
		const currentStreakInfo = await getUserStreak(DB, leetcodeUsername);
		let currentStreak = 0;
		let maxStreak = 0;
		let lastCompletedDate: string | null = null;

		if (currentStreakInfo) {
			currentStreak = currentStreakInfo.currentStreak;
			maxStreak = currentStreakInfo.maxStreak;
			lastCompletedDate = currentStreakInfo.lastCompletedDate;
		}

		// If already completed for this date, do nothing
		if (lastCompletedDate === date) {
			return;
		}

		// Calculate new streak
		const yesterdayStr = getPreviousDate(date);

		if (lastCompletedDate === yesterdayStr) {
			currentStreak += 1;
		} else {
			currentStreak = 1;
		}

		if (currentStreak > maxStreak) {
			maxStreak = currentStreak;
		}

		await DB.prepare(
			`INSERT INTO leetcode_user_streak (leetcode_username, current_streak, max_streak, last_completed_date)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(leetcode_username) DO UPDATE SET current_streak = excluded.current_streak, max_streak = excluded.max_streak, last_completed_date = excluded.last_completed_date`,
		)
			.bind(leetcodeUsername, currentStreak, maxStreak, date)
			.run();
	} catch (error) {
		console.error("Error updating user streak:", error);
	}
}

export async function overwriteUserStreak(
	DB: D1Database,
	leetcodeUsername: string,
	newStreak: number,
): Promise<boolean> {
	try {
		// Check if user exists first
		const currentStreakInfo = await getUserStreak(DB, leetcodeUsername);
		if (!currentStreakInfo) {
			return false;
		}

		await DB.prepare(
			`UPDATE leetcode_user_streak 
             SET current_streak = ?1, 
                 max_streak = MAX(max_streak, ?1)
             WHERE leetcode_username = ?2`,
		)
			.bind(newStreak, leetcodeUsername)
			.run();

		return true;
	} catch (error) {
		console.error("Error overwriting user streak:", error);
		return false;
	}
}
