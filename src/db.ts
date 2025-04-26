export async function checkSubscriber(DB: D1Database, chatId: number): Promise<boolean> {
  try {
    const existingRecords = await DB.prepare(
      "SELECT * FROM chat WHERE chat_id = ?"
    )
    .bind(chatId)
    .all();

    return existingRecords.results.length > 0;
  } catch (error) {
    console.error("Error checking subscriber:", error);
    return false;
  }
}

export async function insertSubscriber(DB: D1Database, chatId: number): Promise<boolean> {
  try {
    const result = await DB.prepare(
      "INSERT INTO chat (chat_id) VALUES (?)"
    )
    .bind(chatId)
    .run();

    return result.success;
  } catch (error) {
    console.error("Error inserting subscriber:", error);
    return false;
  }
}

export async function deleteSubscriber(DB: D1Database, chatId: number): Promise<boolean> {
  try {
    const result = await DB.prepare(
      "DELETE FROM chat WHERE chat_id = ?"
    )
    .bind(chatId)
    .run();

	return result.success;
  } catch (error) {
    console.error("Error deleting subscriber:", error);
    return false;
  }
}

export async function addLeetcodeUsername(DB: D1Database, chatId: number, username: string): Promise<boolean> {
  try {
    const result = await DB.prepare(
      "INSERT INTO chat_leetcode_usernames (chat_id, leetcode_username) VALUES (?, ?)"
    )
    .bind(chatId, username)
    .run();
    return result.success;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as Record<string, unknown>).message === "string" &&
      ((error as { message: string }).message.includes("UNIQUE"))
    ) {
      // Already exists, treat as success
      return true;
    }
    console.error("Error adding leetcode username:", error);
    return false;
  }
}

export async function removeLeetcodeUsername(DB: D1Database, chatId: number, username: string): Promise<boolean> {
  try {
    const result = await DB.prepare(
      "DELETE FROM chat_leetcode_usernames WHERE chat_id = ? AND leetcode_username = ?"
    )
    .bind(chatId, username)
    .run();
    return result.success;
  } catch (error) {
    console.error("Error removing leetcode username:", error);
    return false;
  }
}
