-- Keep explicit assigned-review access while removing access to the unassigned pool.
ALTER POLICY leads_select ON public.leads USING(deleted_at IS NULL AND (public.crm_is_owner() OR public.crm_can_access_household(household_id) OR public.crm_can_read_assigned_intake(household_id,id,NULL)));
ALTER POLICY households_select ON public.households USING(deleted_at IS NULL AND merged_into_household_id IS NULL AND (public.crm_can_access_household(id) OR public.crm_can_read_assigned_intake(id,NULL,NULL)));
NOTIFY pgrst,'reload schema';
