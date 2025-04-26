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
	questionId: string;
	questionDifficulty: string;
	url: string;
}

export async function getDailyQuestion(
	DB: D1Database,
	date: string,
): Promise<LcDailyProblem | null> {
	try {
		const dbResult = await DB.prepare(
			"SELECT date, title, question_id, difficulty, url FROM lcdailyquestion WHERE date = ?",
		)
			.bind(date)
			.run();

		if (dbResult.results.length > 0) {
			return {
				date: dbResult.results[0].date as string,
				questionTitle: dbResult.results[0].title as string,
				questionId: dbResult.results[0].question_id as string,
				questionDifficulty: dbResult.results[0].difficulty as string,
				url: dbResult.results[0].url as string,
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
			"INSERT INTO lcdailyquestion (date, title, question_id, difficulty, url) VALUES (?, ?, ?, ?, ?)",
		)
			.bind(
				data.date,
				data.questionTitle,
				data.questionId,
				data.questionDifficulty,
				data.url,
			)
			.run();

		return result.success;
	} catch (error) {
		console.error("Error inserting daily question:", error);
		return false;
	}
}
