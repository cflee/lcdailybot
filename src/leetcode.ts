import { getProblemInfo } from "./clist";
import {
	getDailyQuestion,
	insertDailyQuestion,
	setDailyQuestionRating,
} from "./db";
import type { LcDailyProblem } from "./db";

export function toUtcDateString(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function todayUtcDate(): string {
	return toUtcDateString(new Date());
}

export function getPreviousDate(dateStr: string): string {
	const date = new Date(dateStr);
	date.setUTCDate(date.getUTCDate() - 1);
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
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

export interface LcApiDailyProblem {
	date: string;
	questionTitle: string;
	questionTitleSlug: string;
	questionId: string;
	questionDifficulty: string;
	url: string;
}

export async function leetcodeApiDaily(): Promise<LcApiDailyProblem> {
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
	const daily = data?.activeDailyCodingChallengeQuestion;
	const question = daily?.question;
	if (
		!daily ||
		!question ||
		typeof daily.date !== "string" ||
		!/^\d{4}-\d{2}-\d{2}$/.test(daily.date) ||
		typeof daily.link !== "string" ||
		!/^\/problems\/[a-z0-9-]+\/(?:\?.*)?$/.test(daily.link) ||
		typeof question.title !== "string" ||
		!question.title.trim() ||
		typeof question.titleSlug !== "string" ||
		!/^[a-z0-9-]+$/.test(question.titleSlug) ||
		typeof question.questionFrontendId !== "string" ||
		!/^\d+$/.test(question.questionFrontendId) ||
		!["Easy", "Medium", "Hard"].includes(question.difficulty)
	) {
		throw new Error("LeetCode returned an invalid daily challenge");
	}
	return {
		url: `https://leetcode.com${daily.link}`,
		date: daily.date,
		questionId: daily.question.questionFrontendId,
		questionTitle: daily.question.title,
		questionTitleSlug: daily.question.titleSlug,
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

export async function daily(
	DB: D1Database,
	clistApiKey: string,
): Promise<LcDailyProblem> {
	const date = todayUtcDate();
	let question = await getDailyQuestion(DB, date);
	if (!question) {
		const apiDaily = await leetcodeApiDaily();
		if (apiDaily.date !== date) {
			throw new Error(
				`LeetCode daily date ${apiDaily.date} does not match ${date}`,
			);
		}
		// Save the challenge before making an optional Clist request.
		if (!(await insertDailyQuestion(DB, { ...apiDaily, clistRating: null }))) {
			throw new Error(`Failed to cache daily challenge for ${date}`);
		}
		question = await getDailyQuestion(DB, date);
		if (!question)
			throw new Error(`Cached daily challenge missing for ${date}`);
	}
	if (question.clistRating === null && clistApiKey) {
		try {
			const rating = await getProblemInfo(
				clistApiKey,
				question.questionTitleSlug,
			);
			if (rating !== null && Number.isFinite(rating)) {
				await setDailyQuestionRating(DB, date, rating);
				question = (await getDailyQuestion(DB, date)) ?? question;
			}
		} catch (error) {
			console.error("Failed to enrich cached daily challenge:", error);
		}
	}
	return question;
}
