-- Migration: 20261019_categories_complements_and_sauces.sql
-- Transform complements and sauces into first-class menu categories and items.

DO $$
DECLARE
  v_cat_complements_id UUID := gen_random_uuid();
  v_cat_sauces_id UUID := gen_random_uuid();
BEGIN
  -- 1. Create Category: Compléments (if not exists)
  IF NOT EXISTS (SELECT 1 FROM menu_categories WHERE LOWER(name_fr) = 'compléments' OR LOWER(name_fr) = 'complements') THEN
    INSERT INTO menu_categories (id, name_fr, name_en, sort_order, is_active)
    VALUES (v_cat_complements_id, 'Compléments', 'Sides & Complements', 6, true);
  ELSE
    SELECT id INTO v_cat_complements_id FROM menu_categories WHERE LOWER(name_fr) = 'compléments' OR LOWER(name_fr) = 'complements' LIMIT 1;
  END IF;

  -- 2. Create Category: Sauces (if not exists)
  IF NOT EXISTS (SELECT 1 FROM menu_categories WHERE LOWER(name_fr) = 'sauces') THEN
    INSERT INTO menu_categories (id, name_fr, name_en, sort_order, is_active)
    VALUES (v_cat_sauces_id, 'Sauces', 'Sauces', 7, true);
  ELSE
    SELECT id INTO v_cat_sauces_id FROM menu_categories WHERE LOWER(name_fr) = 'sauces' LIMIT 1;
  END IF;

  -- 3. Populate default items in Compléments
  INSERT INTO menu_items (name_fr, name_en, price, category_id, item_type, is_available, sort_order)
  SELECT 'Plantains frit et vapeur', 'Fried & Steamed Plantains', 1000, v_cat_complements_id, 'dish', true, 1
  WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name_fr = 'Plantains frit et vapeur' AND category_id = v_cat_complements_id);

  INSERT INTO menu_items (name_fr, name_en, price, category_id, item_type, is_available, sort_order)
  SELECT 'Miondo', 'Miondo (Cassava Stick)', 1000, v_cat_complements_id, 'dish', true, 2
  WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name_fr = 'Miondo' AND category_id = v_cat_complements_id);

  INSERT INTO menu_items (name_fr, name_en, price, category_id, item_type, is_available, sort_order)
  SELECT 'Pommes Rissolées', 'Sautéed Potatoes', 1000, v_cat_complements_id, 'dish', true, 3
  WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name_fr = 'Pommes Rissolées' AND category_id = v_cat_complements_id);

  INSERT INTO menu_items (name_fr, name_en, price, category_id, item_type, is_available, sort_order)
  SELECT 'Fried Rice (Portion)', 'Fried Rice Portion', 2000, v_cat_complements_id, 'dish', true, 4
  WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name_fr = 'Fried Rice (Portion)' AND category_id = v_cat_complements_id);

  -- 4. Populate default items in Sauces
  INSERT INTO menu_items (name_fr, name_en, price, category_id, item_type, is_available, sort_order)
  SELECT 'Sauce Piment Maison', 'House Hot Pepper Sauce', 500, v_cat_sauces_id, 'dish', true, 1
  WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name_fr = 'Sauce Piment Maison' AND category_id = v_cat_sauces_id);

  INSERT INTO menu_items (name_fr, name_en, price, category_id, item_type, is_available, sort_order)
  SELECT 'Mayonnaise Maison', 'Homemade Mayonnaise', 500, v_cat_sauces_id, 'dish', true, 2
  WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name_fr = 'Mayonnaise Maison' AND category_id = v_cat_sauces_id);

  INSERT INTO menu_items (name_fr, name_en, price, category_id, item_type, is_available, sort_order)
  SELECT 'Sauce Tomate Cuisinée', 'Cooked Tomato Sauce', 500, v_cat_sauces_id, 'dish', true, 3
  WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name_fr = 'Sauce Tomate Cuisinée' AND category_id = v_cat_sauces_id);

  INSERT INTO menu_items (name_fr, name_en, price, category_id, item_type, is_available, sort_order)
  SELECT 'Sauce Vinaigrette', 'Vinaigrette Dressing', 500, v_cat_sauces_id, 'dish', true, 4
  WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE name_fr = 'Sauce Vinaigrette' AND category_id = v_cat_sauces_id);
END $$;
