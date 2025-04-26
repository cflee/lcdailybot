import { getDailyQuestion, insertDailyQuestion } from "./db";
import type { LcDailyProblem } from "./db";

export function todayUtcDate(): string {
	const today = new Date();
	const year = today.getUTCFullYear();
	const month = String(today.getUTCMonth() + 1).padStart(2, "0");
	const day = String(today.getUTCDate()).padStart(2, "0");
	const dateString = `${year}-${month}-${day}`;
	return dateString;
}

async function graphqlRequest<T>(
	endpoint: string,
	query: string,
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	variables?: Record<string, any>,
): Promise<T> {
	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ query, variables }),
	});
	if (!response.ok) {
		throw new Error(`GraphQL request failed with status ${response.status}`);
	}
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	const json: any = await response.json();
	if (json.errors) {
		throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
	}
	return json.data;
}

export async function leetcodeApiDaily(): Promise<LcDailyProblem> {
	const query = `
        query questionOfTodayV2 {
            activeDailyCodingChallengeQuestion {
                date
                userStatus
                link
                question {
                    id: questionId
                    titleSlug
                    title
                    translatedTitle
                    questionFrontendId
                    paidOnly: isPaidOnly
                    difficulty
                    topicTags {
                        name
                        slug
                        nameTranslated: translatedName
                    }
                    status
                    isInMyFavorites: isFavor
                    acRate
                    frequency: freqBar
                }
            }
        }
    `;
	const endpoint = "https://leetcode.com/graphql/";
	const data = await graphqlRequest<{
		activeDailyCodingChallengeQuestion: {
			date: string;
			userStatus: string;
			link: string;
			question: {
				id: string;
				titleSlug: string;
				title: string;
				translatedTitle: string;
				questionFrontendId: string;
				paidOnly: boolean;
				difficulty: string;
				topicTags: {
					name: string;
					slug: string;
					nameTranslated: string;
				}[];
				status: string;
				isInMyFavorites: boolean;
				acRate: string;
				frequency: string;
			};
		};
	}>(endpoint, query);
	const daily = data.activeDailyCodingChallengeQuestion;
	return {
		url: `https://leetcode.com${daily.link}`,
		date: daily.date,
		questionId: daily.question.questionFrontendId,
		questionTitle: daily.question.title,
		questionDifficulty: daily.question.difficulty,
	};
}

export async function leetcodeApiRecentAcSubmissions(
	username: string,
	limit: number,
): Promise<
	{ id: string; title: string; titleSlug: string; timestamp: string }[]
> {
	const query = `
        query recentAcSubmissions($username: String!, $limit: Int!) {
            recentAcSubmissionList(username: $username, limit: $limit) {
                id
                title
                titleSlug
                timestamp
            }
        }
    `;
	const endpoint = "https://leetcode.com/graphql/";
	const data = await graphqlRequest<{
		recentAcSubmissionList: Array<{
			id: string;
			title: string;
			titleSlug: string;
			timestamp: string;
		}>;
	}>(endpoint, query, { username, limit });
	return data.recentAcSubmissionList;
}

export async function daily(DB: D1Database): Promise<LcDailyProblem> {
	const date = todayUtcDate();
	const existingQuestion = await getDailyQuestion(DB, date);
	if (existingQuestion) {
		return existingQuestion;
	}

	const apiDaily = await leetcodeApiDaily();
	const questionData = {
		date: date,
		questionTitle: apiDaily.questionTitle,
		questionId: apiDaily.questionId,
		questionDifficulty: apiDaily.questionDifficulty,
		url: apiDaily.url,
	};

	await insertDailyQuestion(DB, questionData);
	return questionData;
}
