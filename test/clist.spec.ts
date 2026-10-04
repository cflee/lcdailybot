import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getProblemInfo } from "../src/clist";
import type { LcDailyProblem } from "../src/db";
import { getDailyQuestion, setDailyQuestionRating } from "../src/db";
import { daily, todayUtcDate } from "../src/leetcode";

vi.mock("../src/db", () => ({
	getDailyQuestion: vi.fn(),
	insertDailyQuestion: vi.fn(),
	setDailyQuestionRating: vi.fn(),
}));

function waitForAbort(signal: AbortSignal): Promise<never> {
	return new Promise((_, reject) => {
		signal.addEventListener(
			"abort",
			() => reject(new DOMException("Aborted", "AbortError")),
			{ once: true },
		);
	});
}

describe("Clist enrichment timeout", () => {
	const fetchMock = vi.fn<typeof fetch>();

	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal("fetch", fetchMock);
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		expect(vi.getTimerCount()).toBe(0);
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		vi.resetAllMocks();
	});

	it("preserves successful lookup and request parameters", async () => {
		fetchMock.mockResolvedValue(Response.json({ objects: [{ rating: 1800 }] }));
		expect(await getProblemInfo("test-key", "two-sum")).toBe(1800);
		const [url, options] = fetchMock.mock.calls[0];
		expect(String(url)).toBe(
			"https://clist.by/api/v4/json/problem/?resource=leetcode.com&slug=two-sum",
		);
		expect(options?.headers).toEqual({ Authorization: "ApiKey test-key" });
		expect(options?.signal?.aborted).toBe(false);
	});

	it.each(["request", "body"])(
		"aborts a stalled %s after four seconds and returns null",
		async (stage) => {
			let signal: AbortSignal | undefined;
			fetchMock.mockImplementation(async (_, options) => {
				signal = options?.signal as AbortSignal;
				if (stage === "request") return waitForAbort(signal);
				await new Promise((resolve) => setTimeout(resolve, 3_000));
				return {
					ok: true,
					json: () => waitForAbort(signal as AbortSignal),
				} as Response;
			});
			const lookup = getProblemInfo("test-key", "two-sum");
			await vi.advanceTimersByTimeAsync(3_999);
			expect(signal?.aborted).toBe(false);
			await vi.advanceTimersByTimeAsync(1);
			expect(signal?.aborted).toBe(true);
			expect(await lookup).toBeNull();
		},
	);

	it.each([
		["no match", () => Response.json({ objects: [] })],
		["HTTP failure", () => new Response(null, { status: 503 })],
		["invalid JSON", () => new Response("invalid JSON")],
	])("preserves null fallback for %s", async (_, response) => {
		fetchMock.mockResolvedValue(response());
		expect(await getProblemInfo("test-key", "two-sum")).toBeNull();
	});

	it("preserves network failure fallback", async () => {
		fetchMock.mockRejectedValue(new Error("Network error"));
		expect(await getProblemInfo("test-key", "two-sum")).toBeNull();
	});

	it("returns the cached daily after timeout and retries its rating later", async () => {
		const question: LcDailyProblem = {
			date: todayUtcDate(),
			questionTitle: "Two Sum",
			questionTitleSlug: "two-sum",
			questionId: "1",
			questionDifficulty: "Easy",
			url: "https://leetcode.com/problems/two-sum/",
			clistRating: null,
		};
		vi.mocked(getDailyQuestion).mockResolvedValue(question);
		fetchMock.mockImplementationOnce(async (_, options) =>
			waitForAbort(options?.signal as AbortSignal),
		);
		const DB = {} as D1Database;
		const first = daily(DB, "test-key");
		await vi.advanceTimersByTimeAsync(4_000);
		expect(await first).toEqual(question);
		expect(setDailyQuestionRating).not.toHaveBeenCalled();

		fetchMock.mockResolvedValueOnce(
			Response.json({ objects: [{ rating: 1800 }] }),
		);
		vi.mocked(getDailyQuestion)
			.mockResolvedValueOnce(question)
			.mockResolvedValueOnce({ ...question, clistRating: 1800 });
		expect(await daily(DB, "test-key")).toEqual({
			...question,
			clistRating: 1800,
		});
		expect(setDailyQuestionRating).toHaveBeenCalledWith(
			DB,
			question.date,
			1800,
		);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
