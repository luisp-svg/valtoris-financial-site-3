import { setupServiceTestDatabase } from "./test-service-production-db.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const f = await setupServiceTestDatabase();
let passed = 0;
const check = async (name, fn) => {
  await fn();
  passed++;
  console.log("PASS " + name);
};
try {
  const owner = await f.session("owner"),
    advisor = await f.session("advisor"),
    other = await f.session("other"),
    anon = await f.session("anon");
  const o = await f.opportunity("health");
  const id = (
    await owner.query("SELECT create_service_production($1,$2,$3) id", [
      o,
      f.payload("health"),
      JSON.stringify([{ advisor_id: f.advisors.advisor, writing_bps: 10000 }]),
    ])
  ).rows[0].id;
  const allocation = (
    await f.db.query(
      "SELECT id FROM service_production_allocations WHERE record_id=$1",
      [id],
    )
  ).rows[0].id;
  const payload = (patch = {}) => ({
    action: "paid",
    payment_leg: "carrier_to_imo",
    amount_cents: 10000,
    effective_date: "2026-09-27",
    reason: "QA evidence confirmed",
    evidence_reference: "QA source",
    provider_reference: "QA provider",
    transaction_reference: randomUUID(),
    statement_identifier: "QA statement",
    idempotency_key: randomUUID(),
    ...patch,
  });
  const post = (p, c = owner, aid = allocation) =>
    c.query("SELECT record_commission_fact($1,$2,$3,$4) result", [
      "service",
      id,
      aid,
      p,
    ]);
  let released, paid;
  await check("carrier release posts without agent payment", async () => {
    released = (await post(payload())).rows[0].result.id;
    assert.equal(
      (
        await f.db.query(
          "SELECT count(*) FROM policy_writing_commission_events WHERE payment_leg='imo_to_agent'",
        )
      ).rows[0].count,
      "0",
    );
  });
  await check("agent payment is separately evidenced", async () => {
    paid = (
      await post(payload({ payment_leg: "imo_to_agent", amount_cents: 7500 }))
    ).rows[0].result.id;
  });
  await check(
    "advisor sees own facts and other advisor sees none",
    async () => {
      assert.equal(
        (await advisor.query("SELECT * FROM policy_writing_commission_events"))
          .rowCount,
        2,
      );
      assert.equal(
        (await other.query("SELECT * FROM policy_writing_commission_events"))
          .rowCount,
        0,
      );
    },
  );
  await check("advisor and anonymous cannot post", async () => {
    await assert.rejects(post(payload(), advisor));
    await assert.rejects(post(payload(), anon));
  });
  await check("direct insert denied even to owner", async () => {
    await assert.rejects(
      owner.query(
        "INSERT INTO policy_writing_commission_events DEFAULT VALUES",
      ),
    );
  });
  await check("negative payment and positive chargeback rejected", async () => {
    await assert.rejects(post(payload({ amount_cents: -5 })));
    await assert.rejects(
      post(payload({ action: "chargeback", amount_cents: 5 })),
    );
  });
  await check(
    "missing evidence, future date, fractional cents rejected",
    async () => {
      await assert.rejects(post(payload({ evidence_reference: "" })));
      await assert.rejects(post(payload({ effective_date: "2099-01-01" })));
      await assert.rejects(post(payload({ amount_cents: 1.1 })));
    },
  );
  await check("invalid allocation rejected", async () => {
    await assert.rejects(post(payload(), owner, randomUUID()));
  });
  await check(
    "identical retry posts once, conflicting retry fails",
    async () => {
      const p = payload();
      const a = (await post(p)).rows[0].result.id;
      assert.equal((await post(p)).rows[0].result.id, a);
      await assert.rejects(post({ ...p, amount_cents: 500 }));
      await assert.rejects(post({ ...p, reason: "different" }));
    },
  );
  await check("concurrent retry creates one financial fact", async () => {
    const p = payload();
    const owner2 = await f.session("owner");
    const [a, b] = await Promise.all([post(p), post(p, owner2)]);
    assert.equal(a.rows[0].result.id, b.rows[0].result.id);
  });
  await check(
    "duplicate source blocked within leg, allowed across transfer legs",
    async () => {
      const p = payload();
      await post(p);
      await assert.rejects(post({ ...p, idempotency_key: randomUUID() }));
      await post({
        ...p,
        idempotency_key: randomUUID(),
        payment_leg: "imo_to_agent",
      });
    },
  );
  await check("carrier chargeback does not deduct agent payment", async () => {
    const n = (
      await f.db.query(
        "SELECT sum(amount_cents) total FROM policy_writing_commission_events WHERE payment_leg='imo_to_agent'",
      )
    ).rows[0].total;
    await post(payload({ action: "chargeback", amount_cents: -1000 }));
    assert.equal(
      (
        await f.db.query(
          "SELECT sum(amount_cents) total FROM policy_writing_commission_events WHERE payment_leg='imo_to_agent'",
        )
      ).rows[0].total,
      n,
    );
  });
  await check("reversal retains original and original leg", async () => {
    await owner.query(
      "SELECT reverse_policy_writing_commission_event($1,$2,$3)",
      [paid, "QA reversal", randomUUID()],
    );
    const r = (
      await f.db.query(
        "SELECT * FROM policy_writing_commission_events WHERE reversed_event_id=$1",
        [paid],
      )
    ).rows[0];
    assert.equal(r.payment_leg, "imo_to_agent");
    assert.equal(r.amount_cents, "-7500");
    assert.equal(
      (
        await f.db.query(
          "SELECT amount_cents FROM policy_writing_commission_events WHERE id=$1",
          [paid],
        )
      ).rows[0].amount_cents,
      "7500",
    );
    await assert.rejects(
      owner.query("SELECT reverse_policy_writing_commission_event($1,$2,$3)", [
        r.id,
        "QA invalid",
        randomUUID(),
      ]),
    );
  });
  await check(
    "wrong-leg reversal fails even through internal insert",
    async () => {
      await assert.rejects(
        f.db.query(
          "INSERT INTO policy_writing_commission_events(account_id,service_record_id,service_allocation_id,advisor_id,event_type,amount_cents,payment_leg,attribution_status,idempotency_key,reason,reversed_event_id) SELECT account_id,service_record_id,service_allocation_id,advisor_id,'reversal',-amount_cents,'imo_to_agent',attribution_status,$2,'QA wrong leg',id FROM policy_writing_commission_events WHERE id=$1",
          [released, randomUUID()],
        ),
      );
    },
  );
  const workflow = {
    action: "eligible",
    effective_date: "2026-09-27",
    reason: "QA review",
    evidence_reference: "QA checklist",
    idempotency_key: randomUUID(),
  };
  await check("eligibility adds no money and remains private", async () => {
    const n = (
      await f.db.query(
        "SELECT count(*) n FROM policy_writing_commission_events",
      )
    ).rows[0].n;
    await post(workflow);
    assert.equal(
      (
        await f.db.query(
          "SELECT count(*) n FROM policy_writing_commission_events",
        )
      ).rows[0].n,
      n,
    );
    assert.equal(
      (await advisor.query("SELECT * FROM writing_commission_workflow_events"))
        .rowCount,
      1,
    );
    assert.equal(
      (await other.query("SELECT * FROM writing_commission_workflow_events"))
        .rowCount,
      0,
    );
    await assert.rejects(
      anon.query("SELECT * FROM writing_commission_workflow_events"),
    );
  });
  await check(
    "workflow retry and cross-kind idempotency protected",
    async () => {
      await post(workflow);
      assert.equal(
        (
          await advisor.query(
            "SELECT * FROM writing_commission_workflow_events",
          )
        ).rowCount,
        1,
      );
      await assert.rejects(
        post({ ...workflow, action: "eligibility_revoked" }),
      );
      await assert.rejects(
        post(payload({ idempotency_key: workflow.idempotency_key })),
      );
    },
  );
  await check("service pending and clear retain history", async () => {
    await post({
      ...workflow,
      idempotency_key: randomUUID(),
      action: "pending_confirmed",
      amount_cents: 500,
    });
    await post({
      ...workflow,
      idempotency_key: randomUUID(),
      action: "pending_cleared",
    });
    assert.equal(
      (await advisor.query("SELECT * FROM writing_commission_workflow_events"))
        .rowCount,
      3,
    );
  });
  await check("authenticated updates and deletes denied", async () => {
    await assert.rejects(
      owner.query(
        "UPDATE policy_writing_commission_events SET reason='changed'",
      ),
    );
    await assert.rejects(
      owner.query("DELETE FROM writing_commission_workflow_events"),
    );
  });
  await check(
    "allocation replacement preserves historical money attribution",
    async () => {
      await owner.query(
        "SELECT set_service_production_allocations($1,1,$2,$3)",
        [
          id,
          JSON.stringify([
            { advisor_id: f.advisors.other, writing_bps: 10000 },
          ]),
          "QA replacement",
        ],
      );
      assert.equal(
        (await other.query("SELECT * FROM policy_writing_commission_events"))
          .rowCount,
        0,
      );
      assert.ok(
        (await advisor.query("SELECT * FROM policy_writing_commission_events"))
          .rowCount > 0,
      );
      await post(payload({ payment_leg: "imo_to_agent", amount_cents: 300 }));
    },
  );

  await check(
    "policy agent receipt is excluded from legacy carrier snapshots",
    async () => {
      const carrier = randomUUID(),
        product = randomUUID();
      await f.db.query(
        "INSERT INTO carriers(id,code,name,code_normalized,name_normalized) VALUES($1,'commission-qa','QA Carrier','commission-qa','qa carrier')",
        [carrier],
      );
      await f.db.query(
        "INSERT INTO insurance_products(id,carrier_id,name,name_normalized,product_line) VALUES($1,$2,'QA Term','qa term','life_term')",
        [product, carrier],
      );
      const app = (
        await f.db.query(
          "INSERT INTO policy_applications(household_id,carrier_id,product_id,product_line,state) VALUES($1,$2,$3,'life_term','TX') RETURNING id",
          [f.households.advisor, carrier, product],
        )
      ).rows[0].id;
      const alloc = (
        await f.db.query(
          "INSERT INTO policy_agent_allocations(application_id,recipient_type,advisor_id,allocation_role,commission_bps,production_credit_bps,change_reason) VALUES($1,'advisor',$2,'writing',10000,10000,'QA allocation') RETURNING id",
          [app, f.advisors.advisor],
        )
      ).rows[0].id;
      const postPolicy = (p) =>
        owner.query("SELECT record_commission_fact($1,$2,$3,$4)", [
          "policy",
          app,
          alloc,
          p,
        ]);
      await postPolicy(
        payload({ payment_leg: "imo_to_agent", amount_cents: 3500 }),
      );
      const snap = (
        await advisor.query("SELECT pp_writing_commission_snapshot($1) s", [
          app,
        ])
      ).rows[0].s;
      assert.equal(snap.totals.gross_paid_cents, 0);
      assert.equal(snap.accounts[0].events.length, 0);
      await assert.rejects(
        postPolicy(payload({ payment_leg: "carrier_to_imo" })),
      );
      await assert.rejects(
        postPolicy({
          ...workflow,
          action: "pending_confirmed",
          amount_cents: 100,
          idempotency_key: randomUUID(),
        }),
      );
      const release = (
        await owner.query(
          "SELECT record_policy_writing_commission_event_pre_issue($1,'paid',5000,'QA early carrier evidence',$2,$3)",
          [app, randomUUID(), alloc],
        )
      ).rows[0];
      assert.ok(release);
      const snap2 = (
        await advisor.query("SELECT pp_writing_commission_snapshot($1) s", [
          app,
        ])
      ).rows[0].s;
      assert.equal(snap2.totals.gross_paid_cents, 5000);
      assert.equal(snap2.accounts[0].events.length, 1);
    },
  );
  await check("inactive advisor cannot read money or history", async () => {
    await f.db.query("UPDATE profiles SET is_active=false WHERE id=$1", [
      f.users.advisor,
    ]);
    assert.equal(
      (await advisor.query("SELECT * FROM policy_writing_commission_events"))
        .rowCount,
      0,
    );
    assert.equal(
      (await advisor.query("SELECT * FROM writing_commission_workflow_events"))
        .rowCount,
      0,
    );
  });
  console.log(JSON.stringify({ passed, failed: 0, productionTouched: false }));
} finally {
  await f.close();
}
