-- "About the shop" text on the home page, editable in Admin -> Website -> About the shop.
alter table public.settings add column if not exists about_heading text check (char_length(about_heading) <= 120);
alter table public.settings add column if not exists about_text text check (char_length(about_text) <= 3000);

update public.settings set
  about_heading = coalesce(about_heading, 'Old-school craft. New York attitude.'),
  about_text = coalesce(about_text, $about$NYC Barbershop brings a little bit of the Big Apple to the Gold Coast. Since opening our doors in 2023 at Coomera East Shopping Centre, we have built our shop on sharp cuts, clean fades and the kind of relaxed, friendly chat that keeps people coming back.

Whether it's a skin fade, a classic scissor cut, a beard shape-up or a quick line up between visits, our barbers take the time to get it right. Every cut is finished properly – clean edges, sharp lines and styled the way you like it.

Book online in under a minute, or just walk in – walk-ins are always welcome. Kids, teens, tradies, office crew – everyone gets the same attention to detail.$about$)
where id = 1;
