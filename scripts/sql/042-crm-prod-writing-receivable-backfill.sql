-- 042 CRM-prod historical writing-receivable backfill
-- DO NOT RUN IN THIS PHASE.
-- Do not apply until Migration 042 is reviewed, committed, and applied to CRM-prod.
--
-- Owner-confirmed population: every CRM-prod application imported as kind=existing.
-- Reason: historical in-force book; writing commission previously paid
--
-- Must NOT include current production:
--   LS806821100, ST11194256, LS809995000, LS239209700, ST11314961, ST11507704,
--   9080016982, 0114372440, ST11987577, ST11979248, 7364808, LS237059700,
--   LS237978200, ST11307299, 7710055600, 7710055605
--
-- Re-read 2026-08-18: 29 rows. Sarah SG7 / Bryon SG7 are absent.

-- After 042 is applied, the owner calls this RPC once per id:
--   set_policy_application_writing_receivable_expected(
--     p_application_id := '<id>',
--     p_writing_receivable_expected := false,
--     p_reason := 'historical in-force book; writing commission previously paid'
--   );

-- b027f31c-e13c-477f-a04c-974ab35d2715  Adrian Plesha                 4250099693
-- d42ba66c-0f2d-4248-87b6-15e37a570b9e  Amanda Haney                  LS075679000
-- 6d91bdfe-3a37-49fa-8558-e73c578d892a  Anna Lesly Gonzales Flores    4240120845
-- 3b9c14d3-b229-43dd-bc78-545a47c72ac4  Arlette Mariee Gomez Gonzalez 4240116022
-- 9070d68e-06a0-47e0-95a9-4b6f94de73e4  Bernabe C Flores              4240109470
-- b93f8efd-b4c1-4089-9e7f-ab82c313c4ce  Brittany Aldana               4240083378
-- 02333ed1-4bf6-4a52-afe6-d91b877a59a1  Bryon BJ Nordeoff             LS2209414
-- 4978aff5-0002-48ff-a8c5-aef11be90387  Danielle Nicole King          723089900
-- a18ba2f9-dbf0-4abd-9d88-766a8e6bdf7c  Danielle Torres               LS122087200
-- 83da8c44-c648-4724-9bda-6d45acd7cae2  Eduardo Rodriguez             LS074873200
-- 29d6140b-4025-40b1-b795-b6e630745b3b  Ellen Lee                     4250097686
-- aaeb52d5-0661-486c-b139-781562e6a926  Gabriel Taguatinga            4240090936
-- 7cb23113-3227-4a00-9303-068d64d2acdc  Irma Magana                   4190116951
-- fb5570f6-b609-4be0-91ff-b74c98ec82be  Isaiah Rey Lewis              4240109461
-- 99e4d2c6-08c7-4fed-8a2b-b11cf6a07682  Jefferson R Lewis             4240109095
-- 8f7fb339-1f2f-437f-b82d-1d481f4674d9  John Kenny Perez              4240100291
-- 2c64e5b9-987f-472a-ab9c-f12c22d7e33a  Jorge Romero Hernandez        4240083440
-- db98ac7c-3c16-4466-8468-e681916e2e21  Jose Perez Lazano             4240083790
-- e8c705a9-98d0-4a10-b92b-ad971ce8fbc0  Julie Woodbury                LS073793400
-- 27a18768-93f4-4bd7-86fc-718ec21e0ad6  Luis Carlos Marin             4240116782
-- 9de06f75-5856-426b-800f-bc1c76526a54  Luis Carlos Marin             4240116783
-- 2687f35d-81cd-4436-91e4-48e891b7b0f8  Luna Morrell                  4260071497
-- cc8f9871-fdea-4a03-9e57-e1d53141cfeb  Marlo C Lupulio               4250083419
-- 8072590a-15d6-45ee-92f0-dcd1066c92bd  Michael Navarro               LS0885328
-- 973d1e47-0e9b-4a53-8b3f-0e6dd45b4b4d  Opal Gallego                  LS2193899
-- 9031d60e-b7e4-48c0-9f05-1676db32de7e  Sarah Ann Butcher             799945500
-- c6b5651c-7a23-4e79-a2a5-5753f0adb582  Sarah Ann Butcher             LS2194109
-- c281d9b9-3e70-4052-87e6-d1637cfdeb76  Teresa Deanna Martinez        4240090934
-- 695e0233-3729-499e-8566-88d1e590640f  Verenice Marin                4240119911

-- Uncomment only after Migration 042 is applied to CRM-prod and this backfill
-- is explicitly approved. Running as postgres/service_role will fail
-- pp_assert_owner; the owner RPC session is required.
/*
SELECT public.set_policy_application_writing_receivable_expected(
  v.id,
  false,
  'historical in-force book; writing commission previously paid'
)
FROM (
  VALUES
    ('b027f31c-e13c-477f-a04c-974ab35d2715'::uuid),
    ('d42ba66c-0f2d-4248-87b6-15e37a570b9e'::uuid),
    ('6d91bdfe-3a37-49fa-8558-e73c578d892a'::uuid),
    ('3b9c14d3-b229-43dd-bc78-545a47c72ac4'::uuid),
    ('9070d68e-06a0-47e0-95a9-4b6f94de73e4'::uuid),
    ('b93f8efd-b4c1-4089-9e7f-ab82c313c4ce'::uuid),
    ('02333ed1-4bf6-4a52-afe6-d91b877a59a1'::uuid),
    ('4978aff5-0002-48ff-a8c5-aef11be90387'::uuid),
    ('a18ba2f9-dbf0-4abd-9d88-766a8e6bdf7c'::uuid),
    ('83da8c44-c648-4724-9bda-6d45acd7cae2'::uuid),
    ('29d6140b-4025-40b1-b795-b6e630745b3b'::uuid),
    ('aaeb52d5-0661-486c-b139-781562e6a926'::uuid),
    ('7cb23113-3227-4a00-9303-068d64d2acdc'::uuid),
    ('fb5570f6-b609-4be0-91ff-b74c98ec82be'::uuid),
    ('99e4d2c6-08c7-4fed-8a2b-b11cf6a07682'::uuid),
    ('8f7fb339-1f2f-437f-b82d-1d481f4674d9'::uuid),
    ('2c64e5b9-987f-472a-ab9c-f12c22d7e33a'::uuid),
    ('db98ac7c-3c16-4466-8468-e681916e2e21'::uuid),
    ('e8c705a9-98d0-4a10-b92b-ad971ce8fbc0'::uuid),
    ('27a18768-93f4-4bd7-86fc-718ec21e0ad6'::uuid),
    ('9de06f75-5856-426b-800f-bc1c76526a54'::uuid),
    ('2687f35d-81cd-4436-91e4-48e891b7b0f8'::uuid),
    ('cc8f9871-fdea-4a03-9e57-e1d53141cfeb'::uuid),
    ('8072590a-15d6-45ee-92f0-dcd1066c92bd'::uuid),
    ('973d1e47-0e9b-4a53-8b3f-0e6dd45b4b4d'::uuid),
    ('9031d60e-b7e4-48c0-9f05-1676db32de7e'::uuid),
    ('c6b5651c-7a23-4e79-a2a5-5753f0adb582'::uuid),
    ('c281d9b9-3e70-4052-87e6-d1637cfdeb76'::uuid),
    ('695e0233-3729-499e-8566-88d1e590640f'::uuid)
) AS v(id);
*/
