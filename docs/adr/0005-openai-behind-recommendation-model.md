# Meal and shopping advice sit behind RecommendationModel

One process environment variable, `OPENAI_API_KEY`, is the credential for every household. It is not a database column, not a settings screen, and not returned to the browser. When the variable is missing, the call fails, or the reply cites an unknown recipe or nutrition numbers that are not in the catalog, a deterministic matcher answers instead. Favorites stay a local count of use events. Nutrition figures on a meal card always come from the catalog. The prompt may include refrigerator, freezer, and pantry stock, expiry, favorites, and catalog recipes. It does not include receipt text or images.

Considered options: a per-household key the member pastes into the app, or reusing a Codex subscription login. A pasted key would put a secret in the browser and in member-managed storage. Subscription login is a different product and stays out of scope.
