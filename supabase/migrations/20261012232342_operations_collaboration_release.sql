BEGIN;
CREATE TABLE public.operations_comments (
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
 workspace_id uuid NOT NULL,
 item_id uuid NOT NULL,
 author_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,item_id) REFERENCES public.operations_items(workspace_id,id) ON DELETE CASCADE
);
CREATE INDEX operations_comments_item ON public.operations_comments(workspace_id,item_id,created_at);
ALTER TABLE public.operations_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY operations_comments_read ON public.operations_comments FOR SELECT TO authenticated USING(public.operations_access(workspace_id));
CREATE POLICY operations_comments_create ON public.operations_comments FOR INSERT TO authenticated WITH CHECK(public.operations_access(workspace_id) AND author_user_id=auth.uid());
REVOKE ALL ON public.operations_comments FROM anon,authenticated;
GRANT SELECT,INSERT ON public.operations_comments TO authenticated;
CREATE TABLE public.operations_checklist (
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
 workspace_id uuid NOT NULL,
 item_id uuid NOT NULL,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 200),
 done boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,item_id) REFERENCES public.operations_items(workspace_id,id) ON DELETE CASCADE
);
CREATE INDEX operations_checklist_item ON public.operations_checklist(workspace_id,item_id,created_at);
ALTER TABLE public.operations_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY operations_checklist_read ON public.operations_checklist FOR SELECT TO authenticated USING(public.operations_access(workspace_id));
CREATE POLICY operations_checklist_create ON public.operations_checklist FOR INSERT TO authenticated WITH CHECK(public.operations_owner(workspace_id));
REVOKE ALL ON public.operations_checklist FROM anon,authenticated;
GRANT SELECT,INSERT ON public.operations_checklist TO authenticated;
CREATE FUNCTION public.operations_toggle_checklist(p_id uuid,p_expected_done boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.operations_checklist; a uuid;
BEGIN
 SELECT * INTO c FROM public.operations_checklist WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR NOT public.operations_access(c.workspace_id) THEN RAISE EXCEPTION 'Checklist unavailable' USING ERRCODE='42501'; END IF;
 SELECT assigned_user_id INTO a FROM public.operations_items WHERE id=c.item_id AND workspace_id=c.workspace_id FOR UPDATE;
 IF NOT public.operations_owner(c.workspace_id) AND a IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the owner or assigned person can complete this checklist' USING ERRCODE='42501'; END IF;
 IF p_expected_done IS NULL OR c.done<>p_expected_done THEN RAISE EXCEPTION 'Checklist changed. Refresh and try again.'; END IF;
 UPDATE public.operations_checklist SET done=NOT done WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.operations_toggle_checklist(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.operations_toggle_checklist(uuid,boolean) TO authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';
-- Versioned procedures: revisions are immutable and remain inside their workspace.
BEGIN;
CREATE TABLE public.operations_procedures (
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.operations_workspaces(id) ON DELETE CASCADE,
 procedure_key uuid NOT NULL DEFAULT extensions.gen_random_uuid(),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 200),
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 20000),
 author_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,procedure_key,version)
);
ALTER TABLE public.operations_procedures ENABLE ROW LEVEL SECURITY;
CREATE POLICY operations_procedures_read ON public.operations_procedures FOR SELECT TO authenticated USING(public.operations_access(workspace_id));
CREATE POLICY operations_procedures_publish ON public.operations_procedures FOR INSERT TO authenticated WITH CHECK(public.operations_owner(workspace_id) AND author_user_id=auth.uid());
REVOKE ALL ON public.operations_procedures FROM anon,authenticated;
GRANT SELECT,INSERT ON public.operations_procedures TO authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';
