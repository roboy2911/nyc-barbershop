-- Review buttons/emails open Google's "write a review" box directly instead of the Maps listing.
-- Only replaces the old default link, never one an admin pasted in.
update public.settings
set google_review_url = 'https://search.google.com/local/writereview?placeid=ChIJ8eSf-8ETkWsRvuJD16gJc60'
where id = 1 and (google_review_url is null or google_review_url = 'https://www.google.com/maps?cid=12498344011653964478');
alter table public.settings alter column google_review_url
  set default 'https://search.google.com/local/writereview?placeid=ChIJ8eSf-8ETkWsRvuJD16gJc60';
