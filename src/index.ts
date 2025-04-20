/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (request.method === "POST") {
			const url = new URL(request.url);
			if (url.pathname !== "/telegramWebhook") {
				console.log(`Received unexpected path name: ${url.pathname}`);
				return new Response("Not Found", { status: 404 });
			}
			const webhookSecret = env.TELEGRAM_BOT_WEBHOOK_SECRET;
			const receivedToken = request.headers.get(
				"X-Telegram-Bot-Api-Secret-Token",
			);
			if (receivedToken !== webhookSecret) {
				console.log(`Received unexpected token: ${receivedToken}}`);
				return new Response("Unauthorized", { status: 401 });
			}
			const update = await request.json();
			console.log(update);
			return new Response("OK", { status: 200 });
		}
		console.log(
			`Received unexpected method: ${request.method} to ${request.url}`,
		);
		return new Response("Not Found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;
