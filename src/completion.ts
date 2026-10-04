import { getPreviousDate } from "./leetcode";

export async function recordCompletion(
	DB: D1Database,
	date: string,
	username: string,
	completed: boolean,
	submissionUrl: string | null,
): Promise<void> {
	const completion = DB.prepare(`
		INSERT INTO leetcode_daily_completion (date, leetcode_username, completed, submission_url)
		VALUES (?1, ?2, ?3, ?4)
		ON CONFLICT(date, leetcode_username) DO UPDATE SET
			completed = MAX(leetcode_daily_completion.completed, excluded.completed),
			submission_url = COALESCE(excluded.submission_url, leetcode_daily_completion.submission_url)
	`).bind(date, username, completed ? 1 : 0, submissionUrl);
	const statements = [completion];
	if (completed) {
		statements.push(
			DB.prepare(`
			INSERT INTO leetcode_user_streak (leetcode_username, current_streak, max_streak, last_completed_date)
			VALUES (?1, 1, 1, ?2)
			ON CONFLICT(leetcode_username) DO UPDATE SET
				current_streak = CASE WHEN last_completed_date = ?3 THEN current_streak + 1 ELSE 1 END,
				max_streak = MAX(max_streak, CASE WHEN last_completed_date = ?3 THEN current_streak + 1 ELSE 1 END),
				last_completed_date = excluded.last_completed_date
			WHERE last_completed_date IS NULL OR last_completed_date < excluded.last_completed_date
		`).bind(username, date, getPreviousDate(date)),
		);
		// A concurrent run may already have recorded today before yesterday arrived.
		// Repair the suffix from stored completions without moving its date backwards.
		statements.push(
			DB.prepare(`
			WITH RECURSIVE suffix(date) AS (
				SELECT last_completed_date FROM leetcode_user_streak
				WHERE leetcode_username = ?1 AND last_completed_date = date(?2, '+1 day')
				UNION ALL
				SELECT date(suffix.date, '-1 day') FROM suffix
				JOIN leetcode_daily_completion AS completion
				ON completion.leetcode_username = ?1
				AND completion.date = date(suffix.date, '-1 day') AND completion.completed = 1
			)
			UPDATE leetcode_user_streak SET
				current_streak = MAX(current_streak, (SELECT COUNT(*) FROM suffix)),
				max_streak = MAX(max_streak, (SELECT COUNT(*) FROM suffix))
			WHERE leetcode_username = ?1 AND last_completed_date = date(?2, '+1 day')
		`).bind(username, date),
		);
	}
	// D1 batches roll back every statement if any statement fails.
	const results = await DB.batch(statements);
	if (results.some((result) => !result.success)) {
		throw new Error(`Failed to record completion for ${username} on ${date}`);
	}
}
