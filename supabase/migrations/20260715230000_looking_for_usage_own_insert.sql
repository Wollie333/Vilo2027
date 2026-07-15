-- Finding #7: the looking_for_usage INSERT policy was WITH CHECK (TRUE), so any
-- authenticated caller could POST a usage row for ANOTHER user_id via the REST
-- API and inflate that user's Looking-For quota to its cap — a denial-of-service
-- on their ability to post requests / send quotes.
--
-- Restrict inserts to the caller's OWN rows. The server actions that legitimately
-- record usage (sendQuoteAction, guest post creation) run with the service role,
-- which bypasses RLS, so they're unaffected; a guest recording their own usage via
-- a user-bound client still passes (user_id = auth.uid()).
drop policy if exists "Service role can insert usage" on public.looking_for_usage;

create policy "Users insert own usage"
  on public.looking_for_usage for insert
  with check (user_id = auth.uid());
