interface ClistProblemResponse {
	meta: {
		limit: number;
		next: string | null;
		offset: number;
		previous: string | null;
		total_count: number | null;
	};
	objects: Array<{
		id: number;
		name: string;
		rating: number;
		resource: string;
		slug: string;
		url: string;
	}>;
}

async function clistApiGet<T>(
	path: string,
	apiKey: string,
	params: Record<string, string> = {},
): Promise<T> {
	if (!apiKey) {
		throw new Error("Clist API key not provided");
	}

	const url = new URL(`https://clist.by/api/v4/json${path}`);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.append(key, value);
	}

	const response = await fetch(url.toString(), {
		headers: {
			Authorization: `ApiKey ${apiKey}`,
		},
	});

	if (!response.ok) {
		throw new Error(`Clist API request failed with status ${response.status}`);
	}

	return response.json() as Promise<T>;
}

export async function getProblemInfo(
	apiKey: string,
	slug: string,
): Promise<number | null> {
	try {
		const response = await clistApiGet<ClistProblemResponse>(
			"/problem/",
			apiKey,
			{
				resource: "leetcode.com",
				slug: slug,
			},
		);

		if (response.objects && response.objects.length > 0) {
			return response.objects[0].rating;
		}

		return null;
	} catch (error) {
		console.error("Error fetching problem info from Clist:", error);
		return null;
	}
}
