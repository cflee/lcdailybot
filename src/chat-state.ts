import * as db from "./db";

// Finish all reads before sending or editing any Telegram messages for this chat.
export async function loadChatState(
	DB: D1Database,
	date: string,
	chatId: number,
) {
	const usernames = await db.getLeetcodeUsernamesForChat(DB, chatId);
	const statusList = [];
	for (const username of usernames) {
		const completion = await db.getCompletionStatus(DB, date, username);
		const streak = await db.getUserStreak(DB, username);
		statusList.push({
			username,
			completed: completion?.completed ?? false,
			submissionUrl: completion?.submissionUrl ?? null,
			streak: streak?.currentStreak ?? 0,
			lastCompletedDate: streak?.lastCompletedDate ?? null,
		});
	}
	const previouslySentMsg = await db.getDailyMessageSent(DB, date, chatId);
	const previousMessage = previouslySentMsg
		? null
		: await db.getLastDailyMessageSent(DB, chatId, date);
	return { statusList, previouslySentMsg, previousMessage };
}
