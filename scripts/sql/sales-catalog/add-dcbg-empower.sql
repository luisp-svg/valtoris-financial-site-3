-- Authorized catalog data only. No schema, permissions, production, or commission changes.
-- Safe to rerun: existing matching entries are preserved; conflicts abort the transaction.
BEGIN;
LOCK TABLE public.service_verticals, public.pipelines, public.pipeline_stages IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE
  item record;
  stage record;
  vertical public.service_verticals%ROWTYPE;
  pipeline public.pipelines%ROWTYPE;
  existing_stage public.pipeline_stages%ROWTYPE;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('dcbg', 'DCBG'),
    ('empower_employee_benefits', 'Empower Employee Benefits')
  ) entries(code, name) LOOP
    SELECT * INTO vertical FROM public.service_verticals WHERE code = item.code;
    IF NOT FOUND THEN
      INSERT INTO public.service_verticals(code,name,description,sort_order)
      VALUES(item.code,item.name,item.name || ' sales opportunities',
        (SELECT coalesce(max(sort_order),0)+1 FROM public.service_verticals))
      RETURNING * INTO vertical;
    ELSIF vertical.name <> item.name OR NOT vertical.is_active THEN
      RAISE EXCEPTION 'Existing service catalog entry needs review: %', item.code;
    END IF;

    SELECT * INTO pipeline FROM public.pipelines
      WHERE service_vertical_id=vertical.id AND is_default AND is_active;
    IF NOT FOUND THEN
      IF EXISTS (SELECT 1 FROM public.pipelines WHERE service_vertical_id=vertical.id) THEN
        RAISE EXCEPTION 'Existing pipeline configuration needs review: %', item.code;
      END IF;
      INSERT INTO public.pipelines(name,pipeline_type,service_vertical_id,is_default,is_active)
      VALUES(item.name || ' Pipeline','service',vertical.id,true,true)
      RETURNING * INTO pipeline;
    ELSIF pipeline.pipeline_type <> 'service' OR pipeline.name <> item.name || ' Pipeline' THEN
      RAISE EXCEPTION 'Existing pipeline identity needs review: %', item.code;
    END IF;

    FOR stage IN SELECT * FROM (VALUES
      ('identified','Identified',1,false,false,false),
      ('consultation','Consultation',2,false,false,false),
      ('presented','Presented',3,false,false,false),
      ('sold','Sold',4,true,false,false),
      ('closed_lost','Closed / Lost',5,false,true,true)
    ) stages(code,name,sort_order,is_won,is_lost,is_terminal) LOOP
      SELECT * INTO existing_stage FROM public.pipeline_stages
        WHERE pipeline_id=pipeline.id AND code=stage.code;
      IF NOT FOUND THEN
        INSERT INTO public.pipeline_stages(pipeline_id,code,name,sort_order,is_won,is_lost,is_terminal)
        VALUES(pipeline.id,stage.code,stage.name,stage.sort_order,stage.is_won,stage.is_lost,stage.is_terminal);
      ELSIF (existing_stage.name,existing_stage.sort_order,existing_stage.is_won,existing_stage.is_lost,existing_stage.is_terminal)
        IS DISTINCT FROM (stage.name,stage.sort_order,stage.is_won,stage.is_lost,stage.is_terminal) THEN
        RAISE EXCEPTION 'Existing sales stage needs review: % / %', item.code, stage.code;
      END IF;
    END LOOP;
    IF (SELECT count(*) FROM public.pipeline_stages WHERE pipeline_id=pipeline.id) <> 5 THEN
      RAISE EXCEPTION 'Unexpected additional stages: %', item.code;
    END IF;
  END LOOP;
END $$;
COMMIT;
