-- Enable Supabase Realtime publication for orders, payments and menu tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_declarations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_verifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_categories;

-- Set full replica identity for complete row change broadcasts
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.payment_declarations REPLICA IDENTITY FULL;
ALTER TABLE public.payment_verifications REPLICA IDENTITY FULL;
ALTER TABLE public.menu_items REPLICA IDENTITY FULL;
ALTER TABLE public.menu_categories REPLICA IDENTITY FULL;
