const REQUEST_TIMEOUT_MS = 5_000;
const MAX_ATTEMPTS = 3;
const MAX_RETRY_DELAY_MS = 2_000;
const INITIAL_RETRY_DELAY_MS = 500;

export async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
		let delay = INITIAL_RETRY_DELAY_MS * 2 ** attempt;
		try {
			const response = await fetch(url, { ...init, signal: controller.signal });
			if (!response.ok) {
				const retryable = response.status === 429 || response.status >= 500;
				const retryAfter = response.headers.get("Retry-After");
				if (retryAfter !== null) {
					const seconds = Number(retryAfter);
					const requestedDelay = Number.isFinite(seconds)
						? seconds * 1000
						: Date.parse(retryAfter) - Date.now();
					if (Number.isFinite(requestedDelay))
						delay = Math.max(delay, requestedDelay);
				}
				await response.body?.cancel();
				if (
					!retryable ||
					attempt === MAX_ATTEMPTS - 1 ||
					delay > MAX_RETRY_DELAY_MS
				) {
					throw new HttpResponseError(response.status);
				}
			} else {
				// Keep the timeout active until the body has been consumed.
				return (await response.json()) as T;
			}
		} catch (error) {
			if (
				error instanceof HttpResponseError ||
				error instanceof SyntaxError ||
				attempt === MAX_ATTEMPTS - 1
			) {
				throw error;
			}
		} finally {
			clearTimeout(timeout);
		}
		await new Promise((resolve) => setTimeout(resolve, delay));
	}
	throw new Error("API request attempts exhausted");
}

class HttpResponseError extends Error {
	constructor(status: number) {
		super(`API request failed with status ${status}`);
	}
}
