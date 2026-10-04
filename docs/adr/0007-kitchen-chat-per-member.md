# Kitchen chat is one saved thread per member

A member can ask what to cook, use, or buy. The thread is stored for that member in that household and is still there on the next visit. Other members do not see it. Leaving the household deletes that member's turns; a soft-deleted household deletes every turn, so a later household does not inherit the old kitchen chat.

The reply uses the same model order as meal advice: the member's Codex login, then the process `OPENAI_API_KEY`, then a local briefing. The prompt may include stock, expiry, favorites, catalog recipes, and shopping needs. It does not include receipt text or images. A model reply is kept only when every cited recipe id exists and any nutrition figure matches a cited recipe's catalog facts. Otherwise the local briefing answers. Nutrition stays an estimate, not medical advice.

Considered options: one thread shared by the household, or a thread that lasts only for the visit. A shared thread would mix private questions. A visit-only thread would drop the conversation the member asked to keep.
