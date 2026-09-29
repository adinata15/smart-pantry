-- Rename legacy produce category to vegetable
UPDATE "Item" SET "category" = 'vegetable' WHERE "category" = 'produce';
