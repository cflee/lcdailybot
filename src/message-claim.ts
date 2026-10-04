export async function claimDailyMessage(
	DB: D1Database,
	date: string,
	chatId: number,
): Promise<boolean> {
	// An ambiguous send must not be retried automatically: Telegram has no idempotency key.
	const result = await DB.prepare(`
		INSERT INTO daily_message_claim (date, chat_id)
		SELECT ?1, ?2 WHERE NOT EXISTS (
			SELECT 1 FROM daily_question_sent WHERE date = ?1 AND chat_id = ?2
		)
		ON CONFLICT(date, chat_id) DO NOTHING
	`)
		.bind(date, chatId)
		.run();
	if (!result.success) throw new Error("Failed to claim daily message");
	return result.meta.changes === 1;
}
