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
