-- helper functions are only needed by RLS policies for signed-in users;
-- the signup trigger function should not be callable through the API at all.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.can_approve() from public, anon;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_approve() to authenticated;
