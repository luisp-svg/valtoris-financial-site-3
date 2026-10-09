-- Operations pilot; legacy client CRM remains single-organization.
BEGIN;
CREATE TABLE public.operations_workspaces (
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 120),
 owner_user_id uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.operations_members (
 workspace_id uuid NOT NULL REFERENCES public.operations_workspaces(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id),
 PRIMARY KEY(workspace_id,user_id)
);
CREATE FUNCTION public.operations_access(p_workspace_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.operations_workspaces w
 JOIN public.profiles p ON p.id=auth.uid() AND p.is_active AND p.deleted_at IS NULL
 WHERE w.id=p_workspace_id AND (w.owner_user_id=p.id OR EXISTS(
 SELECT 1 FROM public.operations_members m WHERE m.workspace_id=w.id AND m.user_id=p.id)))
$$;
CREATE FUNCTION public.operations_owner(p_workspace_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.operations_access(p_workspace_id) AND EXISTS(
 SELECT 1 FROM public.operations_workspaces WHERE id=p_workspace_id AND owner_user_id=auth.uid())
$$;
REVOKE ALL ON FUNCTION public.operations_access(uuid),public.operations_owner(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.operations_access(uuid),public.operations_owner(uuid) TO authenticated;
CREATE TABLE public.operations_items (
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.operations_workspaces(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('project','task')),
 parent_id uuid,
 CHECK(kind='task' OR parent_id IS NULL),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 200),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=10000),
 division text NOT NULL DEFAULT 'Operations' CHECK(length(division)<=100),
 status text NOT NULL DEFAULT 'backlog' CHECK(status IN ('backlog','planned','in_progress','testing','done','cancelled')),
 priority text NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
 assigned_user_id uuid,
 due_date date,
 blocker text NOT NULL DEFAULT '' CHECK(length(blocker)<=1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,parent_id) REFERENCES public.operations_items(workspace_id,id),
 FOREIGN KEY(workspace_id,assigned_user_id) REFERENCES public.operations_members(workspace_id,user_id)
);
CREATE FUNCTION public.operations_validate_parent() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.parent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.operations_items
 WHERE id=NEW.parent_id AND workspace_id=NEW.workspace_id AND kind='project') THEN
 RAISE EXCEPTION 'Tasks must link to a project in the same workspace' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.operations_validate_parent() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER operations_items_parent BEFORE INSERT OR UPDATE OF parent_id,workspace_id,kind
 ON public.operations_items FOR EACH ROW EXECUTE FUNCTION public.operations_validate_parent();
CREATE INDEX operations_items_queue ON public.operations_items(workspace_id,status,due_date);
CREATE TRIGGER operations_items_updated BEFORE UPDATE ON public.operations_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.operations_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY operations_workspace_read ON public.operations_workspaces FOR SELECT TO authenticated USING(public.operations_access(id) OR (owner_user_id=auth.uid() AND public.crm_is_owner()));
CREATE POLICY operations_workspace_create ON public.operations_workspaces FOR INSERT TO authenticated WITH CHECK(public.crm_is_owner() AND owner_user_id=auth.uid());
CREATE POLICY operations_members_read ON public.operations_members FOR SELECT TO authenticated USING(public.operations_access(workspace_id));
CREATE POLICY operations_members_add ON public.operations_members FOR INSERT TO authenticated WITH CHECK(public.operations_owner(workspace_id) AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=user_id AND p.is_active AND p.deleted_at IS NULL));
CREATE POLICY operations_items_read ON public.operations_items FOR SELECT TO authenticated USING(public.operations_access(workspace_id));
CREATE POLICY operations_items_create ON public.operations_items FOR INSERT TO authenticated WITH CHECK(public.operations_owner(workspace_id));
CREATE POLICY operations_items_update ON public.operations_items FOR UPDATE TO authenticated USING(public.operations_owner(workspace_id)) WITH CHECK(public.operations_owner(workspace_id));
REVOKE ALL ON public.operations_workspaces,public.operations_members,public.operations_items FROM anon,authenticated;
GRANT SELECT,INSERT ON public.operations_workspaces,public.operations_members TO authenticated;
GRANT SELECT,INSERT ON public.operations_items TO authenticated;
GRANT UPDATE(title,description,division,status,priority,assigned_user_id,due_date,blocker) ON public.operations_items TO authenticated;
CREATE FUNCTION public.operations_set_status(p_id uuid,p_status text,p_expected_updated_at timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.operations_items;
BEGIN
 SELECT * INTO r FROM public.operations_items WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT public.operations_access(r.workspace_id) OR
 (NOT public.operations_owner(r.workspace_id) AND r.assigned_user_id IS DISTINCT FROM auth.uid()) THEN
 RAISE EXCEPTION 'Work item unavailable' USING ERRCODE='42501'; END IF;
 IF p_expected_updated_at IS NULL OR r.updated_at<>p_expected_updated_at THEN RAISE EXCEPTION 'This item changed. Refresh and try again.'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('backlog','planned','in_progress','testing','done','cancelled') THEN RAISE EXCEPTION 'Invalid status'; END IF;
 UPDATE public.operations_items SET status=p_status WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.operations_set_status(uuid,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.operations_set_status(uuid,text,timestamptz) TO authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';
