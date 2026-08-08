-- Drop the temporary diagnostic helper added in 20260808120000. It was only
-- used to surface the exact FK that blocked deleting a referred user
-- (affiliate_commissions_referral_id_fkey), now fixed in 20260808130000.

drop function if exists public._diag_try_delete_user(uuid);
