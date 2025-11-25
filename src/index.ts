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

import { Bot, GrammyError, webhookCallback } from "grammy";
import * as db from "./db";
import {
	daily,
	leetcodeApiRecentAcSubmissions,
	todayUtcDate,
} from "./leetcode";

export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (request.method === "POST") {
			const url = new URL(request.url);
			if (url.pathname !== "/telegramWebhook") {
				return new Response("Not Found", { status: 404 });
			}

			const bot = new Bot(env.TELEGRAM_BOT_TOKEN, {
				botInfo: JSON.parse(env.TELEGRAM_BOT_INFO),
			});
			bot.command("start", (ctx) => {
				console.log(`Received start command from chat: ${ctx.chat.id}`);
				return ctx.reply("Hello world", {
					reply_parameters: {
						message_id: ctx.msg.message_id,
					},
				});
			});
			bot.command("subscribe", async (ctx) => {
				const chatId = ctx.chat.id;
				if (await db.checkSubscriber(env.DB, chatId)) {
					await ctx.reply("This chat was already subscribed!", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
					return;
				}
				const ok = await db.insertSubscriber(env.DB, chatId);
				if (ok) {
					await ctx.reply("This chat is now subscribed!", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
				} else {
					await ctx.reply("There was a problem subscribing this chat.", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
				}
			});

			bot.command("unsubscribe", async (ctx) => {
				const chatId = ctx.chat.id;
				if (!(await db.checkSubscriber(env.DB, chatId))) {
					await ctx.reply("This chat was already not subscribed!", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
					return;
				}
				const ok = await db.deleteSubscriber(env.DB, chatId);
				if (ok) {
					await ctx.reply("This chat is now unsubscribed!", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
				} else {
					await ctx.reply("There was a problem unsubscribing this chat.", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
				}
			});
			bot.command("daily", async (ctx) => {
				console.log(`Received daily command from chat: ${ctx.chat.id}`);
				const curDaily = await daily(env.DB, env.CLIST_API_KEY);
				console.log(curDaily);
				const message = `<b>Daily Challenge for ${curDaily.date}</b>
<a href="${curDaily.url}">${curDaily.questionTitle}</a> (${curDaily.questionDifficulty}${curDaily.clistRating ? ` <tg-spoiler>Clist Rating: ${curDaily.clistRating}</tg-spoiler>` : ""})`;
				await ctx.reply(message, {
					parse_mode: "HTML",
					reply_parameters: { message_id: ctx.msg.message_id },
					link_preview_options: { is_disabled: true },
				});
			});

			bot.command("add_leetcode", async (ctx) => {
				const chatId = ctx.chat.id;
				const args = ctx.match?.trim();
				if (!args) {
					await ctx.reply("Usage: /add_leetcode <leetcode_username>", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
					return;
				}
				if (!(await db.checkSubscriber(env.DB, chatId))) {
					await ctx.reply("This chat must subscribe first.", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
					return;
				}
				const username = args.split(/\s+/)[0];
				const ok = await db.addLeetcodeUsername(env.DB, chatId, username);
				if (ok) {
					await ctx.reply(`Added LeetCode username: ${username}`, {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
				} else {
					await ctx.reply("Failed to add LeetCode username.", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
				}
			});

			bot.command("remove_leetcode", async (ctx) => {
				const chatId = ctx.chat.id;
				const args = ctx.match?.trim();
				if (!args) {
					await ctx.reply("Usage: /remove_leetcode <leetcode_username>", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
					return;
				}
				if (!(await db.checkSubscriber(env.DB, chatId))) {
					await ctx.reply("This chat must subscribe first.", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
					return;
				}
				const username = args.split(/\s+/)[0];
				const ok = await db.removeLeetcodeUsername(env.DB, chatId, username);
				if (ok) {
					await ctx.reply(`Removed LeetCode username: ${username}`, {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
				} else {
					await ctx.reply("Failed to remove LeetCode username.", {
						reply_parameters: { message_id: ctx.msg.message_id },
					});
				}
			});

			return webhookCallback(bot, "cloudflare-mod", {
				secretToken: env.TELEGRAM_BOT_WEBHOOK_SECRET,
			})(request);
		}
		return new Response("Not Found", { status: 404 });
	},
	async scheduled(controller, env, ctx) {
		console.log("Scheduled task starting");
		const DB = env.DB;
		const botToken = env.TELEGRAM_BOT_TOKEN;
		const today = todayUtcDate();

		console.log(`Today's date: ${today}`);
		const dailyQuestion = await daily(DB, env.CLIST_API_KEY);
		console.log(`Today's question: ${dailyQuestion.questionTitle}`);

		const allUsernames = await db.getAllLeetcodeUsernames(DB);

		console.log(`Total LeetCode usernames: ${allUsernames.length}`);
		for (const username of allUsernames) {
			const completion = await db.getCompletionStatus(DB, today, username);
			if (completion === null || !completion.completed) {
				try {
					const recents = await leetcodeApiRecentAcSubmissions(username, 20);
					const match = recents.find(
						(s) => s.titleSlug === dailyQuestion.questionTitleSlug,
					);
					const solved = !!match;
					const submissionUrl = match
						? `https://leetcode.com/submissions/detail/${match.id}/`
						: null;
					await db.setCompletionStatus(
						DB,
						today,
						username,
						solved,
						submissionUrl,
					);
					if (solved) {
						await db.updateUserStreak(DB, username, today);
					}
					console.log(
						`Latest completion status for ${username}: ${solved ? "solved" : "not solved"}${submissionUrl ? `, url: ${submissionUrl}` : ""}`,
					);
				} catch (err) {
					console.error(`Failed to get submissions for ${username}:`, err);
				}
			}
		}
		console.log("Completed processing LeetCode usernames");

		const allChats = await db.getAllChats(DB);
		for (const chatId of allChats) {
			console.log(`Processing chat: ${chatId}`);
			const usernames = await db.getLeetcodeUsernamesForChat(DB, chatId);
			const statusList = [];
			for (const username of usernames) {
				const completion = await db.getCompletionStatus(DB, today, username);
				const streak = await db.getUserStreak(DB, username);
				statusList.push({
					username,
					completed: completion?.completed ?? false,
					submissionUrl: completion?.submissionUrl ?? null,
					streak: streak?.currentStreak ?? 0,
				});
			}
			statusList.sort((a, b) => a.username.localeCompare(b.username));
			const emojiLine = statusList
				.map((u) => (u.completed ? "🟢" : "⚪"))
				.join("");
			let msg = `${emojiLine}
<b>Daily Challenge for ${today}</b>
<a href="${dailyQuestion.url}">${dailyQuestion.questionTitle}</a> (${dailyQuestion.questionDifficulty}${dailyQuestion.clistRating ? ` <tg-spoiler>Clist Rating: ${dailyQuestion.clistRating}</tg-spoiler>` : ""})`;
			for (const u of statusList) {
				if (u.completed && u.submissionUrl) {
					msg += `\n🟢 <a href="${u.submissionUrl}">${u.username}</a>`;
				} else {
					msg += `\n${u.completed ? "🟢" : "⚪"} ${u.username}`;
				}
				if (u.streak > 0) {
					msg += ` 🔥 ${u.streak}`;
				}
			}

			const previouslySentMsg = await db.getDailyMessageSent(DB, today, chatId);
			const bot = new Bot(botToken);
			if (previouslySentMsg) {
				// Do not try to edit message if the text is the same, as the editMessageText API will throw an error
				if (msg === previouslySentMsg.messageText) {
					console.log(
						`Message for chat ${chatId} is the same, skipping update`,
					);
				} else {
					try {
						await bot.api.editMessageText(
							chatId,
							Number(previouslySentMsg.messageId),
							msg,
							{
								parse_mode: "HTML",
								link_preview_options: { is_disabled: true },
							},
						);
						await db.setDailyMessageSent(
							DB,
							today,
							chatId,
							Number(previouslySentMsg.messageId),
							msg,
						);
					} catch (e) {
						console.error("Failed to update message:", e);
						if (
							e instanceof GrammyError &&
							e.description.includes("message is not modified")
						) {
							console.log(
								"Force update database with this message since it was not modified",
							);
							await db.setDailyMessageSent(
								DB,
								today,
								chatId,
								Number(previouslySentMsg.messageId),
								msg,
							);
						}
					}
				}
			} else {
				// New message: unpin previous if any, then send and pin new
				const prevDayMsg = await db.getLastDailyMessageSent(DB, chatId, today);
				if (prevDayMsg) {
					try {
						await bot.api.unpinChatMessage(chatId, prevDayMsg.messageId);
					} catch (e) {
						console.log(
							"Unpin previous message failed (but it might not be an error if somebody else unpinned it):",
							e,
						);
					}
				}
				try {
					const sent = await bot.api.sendMessage(chatId, msg, {
						parse_mode: "HTML",
						link_preview_options: { is_disabled: true },
					});
					if (sent?.message_id) {
						await db.setDailyMessageSent(
							DB,
							today,
							chatId,
							sent.message_id,
							msg,
						);
						try {
							await bot.api.pinChatMessage(chatId, sent.message_id, {
								disable_notification: true,
							});
						} catch (e) {
							console.error("Failed to pin message:", e);
						}
					} else {
						console.error("Failed to send message but didn't get an exception");
					}
				} catch (e) {
					console.error("Failed to send message:", e);
				}
			}
			console.log(`Processed chat: ${chatId}`);
		}
	},
} satisfies ExportedHandler<Env>;
