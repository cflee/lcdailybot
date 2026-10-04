# lcdailybot

This is a weekend hack, playing fast and loose with reviews and testing in production, so this is not at all supposed to look like production ready code.
No tests, janky AI-generated code, manual db migrations if any...

## Overview

This is structured as a Cloudflare Worker running some TypeScript code, listening for webhooks from the Telegram Bot API.

It is also regularly run with a [cron trigger](https://developers.cloudflare.com/workers/configuration/cron-triggers/), to update the storage (D1 database) and to send telegram messages out.

## Setup

Create a Cloudflare Worker.
Get the worker's domain on `workers.dev`.

Do the usual flow with `@BotFather` to create a bot.

Take the token and store it in `TELEGRAM_BOT_TOKEN`, as a [secret](https://developers.cloudflare.com/workers/configuration/secrets/) on the Cloudflare Worker, and as a line in your local `.dev.vars` file for running `wrangler dev` and for the types generation.

Generate a webhook secret and store it in `TELEGRAM_BOT_WEBHOOK_SECRET`, similar to the token above.
Ensure it fits within the Telegram Bot API's requirements, 1-256 characters and only `A-Za-z9-0_-` characters is allowed.

## Register worker's webhook with Telegram

Once the worker's webhook is deployed, manually call the [`setWebhook` Bot API method](https://core.telegram.org/bots/api#setwebhook) to register the webhook URL and webhook secret for the bot.

```bash
curl --request POST \
    --header "Content-Type: application/json" \
    --data '{"url":"https://abc.xyz.workers.dev/telegramWebhook","secret_token":"abcdef"}' \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook"
```

Check the bot's configured webhook.

```bash
curl --request GET \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

## Deploy

The secrets are provisioned directly on the Cloudflare dashboard.

Env vars might be from the wrangler config file?

Cron trigger is added and updated in `wrangler.jsonc`.
Only removal is done via the dashboard.

To deploy local code to Cloudflare:

```bash
pnpm run deploy
```

## Recovering an unresolved daily message claim

The cron takes a durable `daily_message_claim` before sending a new daily post.
Concurrent cron runs cannot send the same initial post. Claims do not expire:
a Telegram timeout can mean the message was delivered even though no response
was received. Retrying automatically would risk duplicate posts.

Inspect claims without a corresponding saved message:

```sql
SELECT claim.date, claim.chat_id, claim.claimed_at
FROM daily_message_claim AS claim
WHERE NOT EXISTS (
  SELECT 1 FROM daily_question_sent AS sent
  WHERE sent.date = claim.date AND sent.chat_id = claim.chat_id
);
```

Check the Telegram chat before recovering a claim. If the post exists, save its
message ID and text in `daily_question_sent` and leave the claim in place. If
it was definitely not delivered, delete only that date/chat claim after the
previous cron execution has finished; the next cron may send it. A claim acquired
before a failed database read also requires this recovery. The tradeoff is a
potential missed post until recovery instead of an automatic duplicate send.
This coordinates initial daily posts; reminder sends and message edits are unchanged.
