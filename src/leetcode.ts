export function todayUtcDate(): string {
	const today = new Date();
	const year = today.getUTCFullYear();
	const month = String(today.getUTCMonth() + 1).padStart(2, "0");
	const day = String(today.getUTCDate()).padStart(2, "0");
	const dateString = `${year}-${month}-${day}`;
	return dateString;
}

export async function daily(DB: D1Database): Promise<LcDailyProblem> {
	const date = todayUtcDate();
	const dbResult = await DB.prepare(
		"SELECT 'date', title, question_id, difficulty, url FROM lcdailyquestion WHERE 'date' = ?",
	)
		.bind(date)
		.run();
	if (dbResult.results.length > 0) {
		// return data from the row, as DailyProblemData
		return {
			date: dbResult.results[0].date as string,
			questionTitle: dbResult.results[0].title as string,
			questionId: dbResult.results[0].question_id as string,
			questionDifficulty: dbResult.results[0].difficulty as string,
			url: dbResult.results[0].url as string,
		}
	}

	const apiDaily = await alfaLeetcodeApiDaily();
	await DB.prepare(
		"INSERT INTO lcdailyquestion ('date', title, question_id, difficulty, url) VALUES (?, ?, ?, ?, ?)"
	)
		.bind(
			date,
			apiDaily.questionTitle,
			apiDaily.questionId,
			apiDaily.difficulty,
			apiDaily.questionLink
		)
		.run();

	return {
		date: date,
		questionTitle: apiDaily.questionTitle,
		questionId: apiDaily.questionId,
		questionDifficulty: apiDaily.difficulty,
		url: apiDaily.questionLink,
	};

}

export async function alfaLeetcodeApiDaily(): Promise<AlfaDailyProblemData> {
	const response = fetch("https://alfa-leetcode-api.onrender.com/daily", {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
	});
	return (await (await response).json()) satisfies AlfaDailyProblemData;
}

export interface LcDailyProblem {
	date: string;
	questionTitle: string;
	questionId: string;
	questionDifficulty: string;
	url: string;
}

interface AlfaDailyProblemData {
	questionLink: string;
	date: string;
	questionId: string;
	questionTitle: string;
	difficulty: string;
}
