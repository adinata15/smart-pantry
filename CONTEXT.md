# Smart Pantry

The shared kitchen a household cooks from: what is on hand, what is about to expire, and what to make or buy next.

## Language

**Household**:
The shared kitchen a group of people stock and cook from.
_Avoid_: Account, family, tenant

**Member**:
A person who belongs to exactly one household.
_Avoid_: User, account

**Owner**:
The member who created the household.
_Avoid_: Admin, manager

**Invite code**:
The code a person uses to become a member of an existing household.
_Avoid_: Link, token, password

**Household leave**:
A member exits their household. If they are the owner and others remain, they appoint a new owner first. If they are the last member, the household is soft-deleted. They may create or join a household afterward.
_Avoid_: Switch, transfer, migrate

**Storage location**:
Where a stock lot sits: Refrigerator, Freezer, or Pantry. Meal matching uses stock in all three.
_Avoid_: Shelf, zone, bin

**Item**:
A canonical food the household keeps, such as milk or eggs, with an optional par level.
_Avoid_: Product, SKU, ingredient

**Par level**:
The amount of an item the household wants to have on hand.
_Avoid_: Minimum, threshold, reorder point

**Stock lot**:
A quantity of an item in one storage location, with an optional expiry date.
_Avoid_: Batch, package, unit

**Expiry**:
The calendar date a stock lot should be used by.
_Avoid_: Best before, sell-by

**Use**:
A consumption event. The quantity comes off the soonest-expiring stock lot first.
_Avoid_: Delete, waste, decrement

**Favorite**:
An item among the most used foods in the last 30 days, with at least two uses, or an item a member pins.
_Avoid_: Like, preference, recommendation

**Recipe**:
A named way to cook a meal, with ingredients and per-serving nutrition facts.
_Avoid_: Dish, menu item

**Meal suggestion**:
A recipe scored against the food in the refrigerator, freezer, and pantry.
_Avoid_: Plan, menu

**Meal use**:
A use of every ingredient in one recipe, only when each ingredient is already on hand.
_Avoid_: Consume, cook log

**Shopping need**:
Something to buy, with a reason: below par, a favorite running low, or missing from a near-match recipe.
_Avoid_: Cart line, list item

**Nutrition advice**:
Short guidance for one meal, based on catalog nutrition facts. Estimates, not medical advice.
_Avoid_: Diet, diagnosis, prescription

**Receipt line**:
A proposed item, quantity, and price read from a receipt, before a member commits it as stock.
_Avoid_: Scan, invoice line
