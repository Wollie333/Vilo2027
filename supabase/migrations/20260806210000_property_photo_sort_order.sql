-- Atomic, collision-free sort_order for property_photos.
--
-- registerListingPhotoAction assigned sort_order from a pre-read COUNT(*), so
-- the concurrent uploader (4 at a time) had every in-flight insert read the SAME
-- count and write the SAME sort_order — making the cover photo (sort_order 0)
-- non-deterministic. Assign it in the DB instead: when an insert leaves
-- sort_order NULL, take max+1 under a per-property transaction advisory lock so
-- concurrent inserts serialize and get distinct, monotonic values.
--
-- The column stays `integer NOT NULL`; we only drop its DEFAULT so an omitted /
-- explicit-NULL value reaches the BEFORE trigger (which runs before the NOT NULL
-- check) instead of silently defaulting to 0. Existing inserts that pass an
-- explicit sort_order are unaffected (the trigger only fills NULLs).

alter table public.property_photos alter column sort_order drop default;

create or replace function public.set_property_photo_sort_order()
returns trigger
language plpgsql
as $$
begin
  if new.sort_order is null then
    perform pg_advisory_xact_lock(
      hashtextextended('property_photos_sort:' || new.property_id::text, 0)
    );
    select coalesce(max(sort_order) + 1, 0)
      into new.sort_order
      from public.property_photos
     where property_id = new.property_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_property_photos_sort_order on public.property_photos;
create trigger trg_property_photos_sort_order
  before insert on public.property_photos
  for each row
  execute function public.set_property_photo_sort_order();
