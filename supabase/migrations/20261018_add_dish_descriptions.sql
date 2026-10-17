-- Migration: 20261018_add_dish_descriptions.sql
-- Description: Adds optional bilingual descriptions (description_fr, description_en) to menu_items

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS description_fr TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS description_en TEXT DEFAULT NULL;

COMMENT ON COLUMN public.menu_items.description_fr IS 'Optional detailed description of the menu item in French.';
COMMENT ON COLUMN public.menu_items.description_en IS 'Optional detailed description of the menu item in English.';
