-- Extend the shared read-only catalog; existing preferences and tracking rows stay intact.
insert into public.themes(id,name) values ('neumorphism','Neumorphism')
on conflict (id) do nothing;
