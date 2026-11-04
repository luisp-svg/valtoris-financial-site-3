import { premiumSpanishConsent } from "../components/premium/consentLabels";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AssessmentBrandHeader from "../components/AssessmentBrandHeader";
import PublicLocaleSwitcher from "../components/publicSite/PublicLocaleSwitcher";
import PrioritySelector from "../components/premium/PrioritySelector";
import { readPublicLocale } from "../components/publicSite/locale";
import { useHomeDocumentMeta } from "../components/publicSite/home/useHomeDocumentMeta";
import { usePublicDocumentLang } from "../components/publicSite/usePublicDocumentLang";
import FamilyConsentSection from "../components/assessment/steps/FamilyConsentSection";
import { US_STATES } from "../components/assessment/constants";
import {
  applyPhoneChangeToConsent,
  buildFamilyConsentSnapshot,
  INITIAL_FAMILY_CONSENT_STATE,
  validateRequiredFamilyConsent,
} from "../components/reportCard/familyIngest/familyConsent";
import { beginNewFamilyAssessmentSession } from "../components/reportCard/familyIngest/submissionSession";
import { buildFamilyReportCardIngestPayload } from "../components/reportCard/familyIngest/buildFamilyIngestPayload";
import {
  COMBINED_FORMAT,
  COMBINED_VERSION,
  PRIORITIES,
  combinedQuestions,
  combinedValidationIssue,
  isPriority,
  primaryAssessment,
  pruneCombined,
  updateCombined,
  validCombinedQuestion,
  validateCombined,
  type Priority,
} from "../modules/reportCard/combined/engine";
import type { ShortDiagnostic } from "../modules/reportCard/shortForm/contract";
import "../components/premium/premium.css";
import "../components/premium/atelier.css";
const ENDPOINT = "/api/ingest-family-report-card?flow=premium";

export default function FinancialAssessmentPage({
  initialPriority,
  consultationOnly = false,
}: {
  initialPriority?: Priority;
  consultationOnly?: boolean;
}) {
  const location = useLocation(),
    navigate = useNavigate(),
    locale = readPublicLocale(location.search),
    es = locale === "es";
  usePublicDocumentLang(locale);
  useHomeDocumentMeta({
    metaTitle: es
      ? "Evaluación Financiera | Valtoris Financial"
      : "Financial Assessment | Valtoris Financial",
    metaDescription: es
      ? "Una revisión coordinada de tus prioridades financieras."
      : "A coordinated review of your financial priorities.",
  });
  const errorHeading = useRef<HTMLParagraphElement>(null);
  const formOpenedAt = useRef(new Date().toISOString());
  const t = (en: string, spanish: string) => (es ? spanish : en);
  const [selected, setSelected] = useState<Priority[]>(() => {
    const values = (
      new URLSearchParams(location.search).get("priorities") ?? ""
    )
      .split(",")
      .filter(isPriority);
    return values.length
      ? [...new Set(values)]
      : initialPriority
        ? [initialPriority]
        : [];
  });
  const [diagnostic, setDiagnostic] = useState<ShortDiagnostic>({});
  const [contact, setContact] = useState({
    fullName: "",
    email: "",
    phone: "",
  });
  const [consent, setConsent] = useState({ ...INITIAL_FAMILY_CONSENT_STATE });
  const [honeypot, setHoneypot] = useState(""),
    [step, setStep] = useState(consultationOnly ? 0 : -1),
    [busy, setBusy] = useState(false),
    [locked, setLocked] = useState(false),
    [error, setError] = useState("");
  const session = useRef<ReturnType<
    typeof beginNewFamilyAssessmentSession
  > | null>(null);
  const submissionId = useRef<string | null>(null),
    inFlight = useRef(false),
    heading = useRef<HTMLHeadingElement>(null);
  const questions = consultationOnly ? [] : combinedQuestions(selected, diagnostic, 1),
    atContact = step >= questions.length,
    q = questions[step];
  useEffect(() => {
    heading.current?.focus();
    window.scrollTo(0, 0);
  }, [step]);
  useEffect(()=>{if(error){errorHeading.current?.focus();errorHeading.current?.scrollIntoView({block:"center",behavior:"smooth"})}},[error]);
  function changePriorities(next: Priority[]) {
    setSelected(next);
    setDiagnostic((current) => pruneCombined(next, current, 1));
    setError("");
  }
  async function begin() {
    if (!selected.length || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      // Issued once per assessment. Retries of the save keep this same identity.
      if (!submissionId.current) {
        const response = await fetch(`${ENDPOINT}&action=start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          credentials: "same-origin",
          signal: AbortSignal.timeout(20000),
        });
        const data = await response.json();
        if (!response.ok || typeof data.submissionId !== "string")
          throw new Error("start");
        submissionId.current = data.submissionId;
        session.current = beginNewFamilyAssessmentSession({
          search: location.search,
          referrer: document.referrer || null,
          storageKey: "valtoris-combined-assessment-session",
        });
        // The contact-only form is already being completed before its secure session is issued.
        if (consultationOnly) session.current.formStartedAt = formOpenedAt.current;
      }
      setStep(0);
    } catch {
      setError(
        t(
          "Your assessment is temporarily unavailable. Please try again shortly.",
          "Tu evaluación no está disponible temporalmente. Intenta de nuevo en breve.",
        ),
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function next() {
    if (inFlight.current) return;
    const issue = consultationOnly ? null : combinedValidationIssue(selected, diagnostic);
    if (issue && (atContact || issue.id === q?.id)) {
      setError(issue.message[locale]);
      if (atContact)
        setStep(questions.findIndex((item) => item.id === issue.id));
      return;
    }
    if (!atContact) {
      if (!validCombinedQuestion(q, diagnostic[q.id])) {
        setError(
          t(
            "Please choose an answer or enter a valid amount.",
            "Selecciona una respuesta o ingresa una cantidad válida.",
          ),
        );
        return;
      }
      setError("");
      setStep((s) => s + 1);
      return;
    }
    const answers = {
      format: COMBINED_FORMAT,
        insuranceRoutingVersion: 1,
      ...(consultationOnly ? {consultationOnly:true as const} : {}),
      selected,
      diagnostic,
      contact,
      locale,
    };
    if (
      !validateCombined(answers) ||
      !validateRequiredFamilyConsent(consent).ok
    ) {
      setError(
        t(
          consultationOnly ? "Enter your full name, a valid email and phone number, and accept both required acknowledgments." : "Review your answers, contact details and required acknowledgments. Retirement age and employee counts must be consistent.",
          consultationOnly ? "Ingresa tu nombre completo, correo y teléfono válidos, y acepta las dos confirmaciones obligatorias." : "Revisa respuestas, datos de contacto y confirmaciones obligatorias. La edad de jubilación y los totales de empleados deben ser coherentes.",
        ),
      );
      return;
    }
    if (consultationOnly && (!session.current || !submissionId.current)) {
      await begin();
      if (!session.current || !submissionId.current) return;
    }
    if (!session.current || !submissionId.current) {
      setError(
        t(
          "Please return to your priorities and start a new session.",
          "Vuelve a tus prioridades e inicia una nueva sesión.",
        ),
      );
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setLocked(true);
    setError("");
    try {
      const body = buildFamilyReportCardIngestPayload({
        submissionId: submissionId.current,
        answers,
        session: session.current,
        consent: buildFamilyConsentSnapshot({
          consent,
          phone: contact.phone,
          consentVersion: consultationOnly ? "valtoris-consultation-request-consent-v1" : "valtoris-financial-assessment-consent-v1",
        }),
        sourcePage: location.pathname,
        clientReportedScore: null,
        clientReportedGrade: null,
        honeypotWebsite: honeypot,
        assessmentType: primaryAssessment(selected),
        assessmentVersion: COMBINED_VERSION,
      });
      const response = await fetch(`${ENDPOINT}&action=save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
          signal: AbortSignal.timeout(20000),
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error("save");
      const query = new URLSearchParams(location.search);
      query.delete("priorities");
      query.set("assessment", submissionId.current);
      navigate(`/assessment-results${query.size ? `?${query}` : ""}`, {
        state: { selected },
      });
    } catch {
      setError(
        t(
          "We could not confirm the save. Your answers remain here. Retry keeps the same submission to avoid duplicates.",
          "No pudimos confirmar el guardado. Tus respuestas permanecen aquí. Reintentar conserva el mismo envío para evitar duplicados.",
        ),
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="premium-assessment">
      <header className="premium-assessment-header">
        <AssessmentBrandHeader />
        <PublicLocaleSwitcher
          locale={locale}
          groupLabel={t("Language", "Idioma")}
          englishLabel="English"
          spanishLabel="Español"
        />
      </header>
      <div className="premium-assessment-inner">
        {step < 0 ? (
          <>
            <p className="premium-kicker">
              {t(
                "THE VALTORIS FINANCIAL ASSESSMENT",
                "LA EVALUACIÓN FINANCIERA VALTORIS",
              )}
            </p>
            <h1 ref={heading} tabIndex={-1}>
              {t(
                consultationOnly ? "Reserve a Conversation" : "What Would You Like to Strengthen?",
                consultationOnly ? "Reserva una conversación" : "¿Qué te gustaría fortalecer?",
              )}
            </h1>
            <p className="premium-lead">
              {t(
                consultationOnly ? "Choose a conversation topic, share your contact details, then select a consultation time. No Report Card is required." : "Choose one or several priorities. We’ll ask relevant questions once, then invite you to reserve your complimentary consultation before opening your detailed results.",
                consultationOnly ? "Elige un tema, comparte tus datos y selecciona una hora para tu consulta. No se requiere un Report Card." : "Elige una o varias prioridades. Haremos las preguntas relevantes una sola vez y te invitaremos a reservar una consulta sin costo antes de abrir tus resultados detallados.",
              )}
            </p>
            <PrioritySelector
              selected={selected}
              onChange={changePriorities}
              locale={locale}
              disabled={busy}
            />
            <div className="premium-selection-footer">
              <p aria-live="polite">
                {selected.length} {t("selected", "seleccionadas")} · {consultationOnly ? t("Contact details, then choose a time.","Tus datos y después el horario.") : t(`About ${Math.max(3, Math.ceil((questions.length * 20 + 60) / 60))} minutes to start; never more than 25 questions including contact details.`, `Unos ${Math.max(3, Math.ceil((questions.length * 20 + 60) / 60))} minutos para comenzar; pueden aparecer preguntas según tus respuestas.`)}
              </p>
              <button
                className="premium-button"
                disabled={!selected.length || busy}
                onClick={() => void begin()}
              >
                {busy
                  ? t("Preparing…", "Preparando…")
                  : t(consultationOnly ? "Continue to Contact Details" : "Begin My Review", consultationOnly ? "Continuar a mis datos" : "Comenzar mi revisión")}{" "}
                ↗
              </button>
            </div>
            <p className="premium-fineprint">
              {t(
                consultationOnly ? "We’ll save your request before showing available appointment times. We’ll complete your financial intake during your consultation." : "Questions adapt to your priorities and answers: up to 22 review questions and 3 contact fields. Consent is separate. You can choose “Not sure.” Detailed documents and follow-up information belong in your consultation intake.",
                "El número de preguntas se adapta a tus prioridades y respuestas. Puedes elegir “No sé”. Los documentos y detalles adicionales se completan durante tu consulta.",
              )}
            </p>
          </>
        ) : (
          <section className="premium-question-card">
            <p className="premium-step-count">
              {atContact
                ? t("Your details · final step", "Tus datos · último paso")
                : t(
                    `Question ${step + 1} of ${questions.length}`,
                    `Pregunta ${step + 1} de ${questions.length}`,
                  )}
            </p>
            {atContact ? (
              <>
                <h1 ref={heading} tabIndex={-1}>
                  {t(consultationOnly ? "Reserve a Conversation" : "Prepare Your Consultation", consultationOnly ? "Reserva una conversación" : "Prepara tu consulta")}
                </h1>
                <p>
                  {t(
                    consultationOnly ? "Share your contact details, then choose your complimentary consultation time. No Report Card is required. We’ll complete your financial intake together during the consultation." : "Save your assessment, then reserve a complimentary consultation to unlock your detailed results. Your saved details carry into booking.",
                    consultationOnly ? "Guarda tus datos y elige una hora para tu consulta sin costo. Completaremos la información financiera juntos durante la consulta." : "Guarda tu evaluación y reserva una consulta sin costo para desbloquear tus resultados detallados. Tus datos guardados se usarán en la reserva.",
                  )}
                </p>
                {consultationOnly && <label className="premium-field">{t('Conversation topic','Tema de conversación')}<select value={selected[0]} onChange={event=>{if(isPriority(event.target.value))setSelected([event.target.value])}} disabled={busy||locked}>{PRIORITIES.map(priority=><option key={priority.id} value={priority.id}>{priority[locale]}</option>)}</select></label>}
                <label className="premium-field">
                  {t(
                    "Full name (first and last)",
                    "Nombre completo (nombre y apellido)",
                  )}
                  <input
                    autoComplete="name"
                    maxLength={201}
                    required
                    disabled={locked}
                    value={contact.fullName}
                    onChange={(e) =>
                      setContact({ ...contact, fullName: e.target.value })
                    }
                  />
                </label>
                <label className="premium-field">
                  {t("Email", "Correo electrónico")}
                  <input
                    autoComplete="email"
                    type="email"
                    maxLength={254}
                    required
                    disabled={locked}
                    value={contact.email}
                    onChange={(e) =>
                      setContact({ ...contact, email: e.target.value })
                    }
                  />
                </label>
                <label className="premium-field">
                  {t(
                    "Phone for appointment matching",
                    "Teléfono para identificar tu cita",
                  )}
                  <input
                    autoComplete="tel"
                    type="tel"
                    maxLength={30}
                    required
                    disabled={locked}
                    value={contact.phone}
                    onChange={(e) => {
                      setContact({ ...contact, phone: e.target.value });
                      setConsent((c) =>
                        applyPhoneChangeToConsent(c, e.target.value),
                      );
                    }}
                  />
                </label>
                <fieldset disabled={locked}>
                  <FamilyConsentSection
                    labels={consultationOnly ? {...(es ? premiumSpanishConsent : {}), storage:t("I understand that Valtoris will store my contact details and consultation request to arrange my appointment.","Entiendo que Valtoris guardará mis datos y solicitud de consulta para coordinar mi cita."),storageHint:t("Required to save your consultation request.","Obligatorio para guardar tu solicitud de consulta.")} : es ? premiumSpanishConsent : undefined}
                    consent={consent}
                    phone={contact.phone}
                    onChange={(field, value) =>
                      setConsent((c) => ({ ...c, [field]: value }))
                    }
                    honeypotValue={honeypot}
                    onHoneypotChange={setHoneypot}
                    showErrors={!!error}
                    missing={validateRequiredFamilyConsent(consent).missing}
                    productTitle={t(
                      "Valtoris Financial Assessment",
                      "Evaluación Financiera Valtoris",
                    )}
                    storageResultName={t(
                      "financial assessment",
                      "evaluación financiera",
                    )}
                    intro={t(
                      "Storage and privacy acknowledgments are required. Follow-up and marketing permissions are optional and separate from booking.",
                      "Las confirmaciones de almacenamiento y privacidad son obligatorias. Los permisos de seguimiento y publicidad son opcionales y separados de la reserva.",
                    )}
                  />
                </fieldset>
              </>
            ) : (
              <>
                <p className="premium-kicker">
                  {q.reviews
                    .map(
                      (type) => PRIORITIES.find((p) => p.id === type)![locale],
                    )
                    .join(" · ")}
                </p>
                <h1 ref={heading} tabIndex={-1} id="combined-question">
                  {q.question.label[locale]}
                </h1>
                {(q.question.helper || q.question.unit) && (
                  <p id="combined-help">
                    {q.question.helper?.[locale]} {q.question.unit?.[locale]}
                  </p>
                )}
                {(q.question.kind === "number" || q.question.kind === "date") ? (
                  <>
                    <label className="premium-field">
                      <span className="visually-hidden">
                        {q.question.label[locale]}
                      </span>
                      <input
                        aria-labelledby="combined-question"
                        aria-describedby={
                          q.question.helper || q.question.unit
                            ? "combined-help"
                            : undefined
                        }
                        type={q.question.kind === "date" ? "date" : "text"}
                        inputMode={q.question.kind === "date" ? undefined : "decimal"}
                        maxLength={14}
                        disabled={diagnostic[q.id] === "unknown"}
                        value={
                          diagnostic[q.id] === "unknown"
                            ? ""
                            : String(diagnostic[q.id] ?? "")
                        }
                        onChange={(e) => {
                          setDiagnostic((d) =>
                            updateCombined(selected, d, q.id, e.target.value, 1),
                          );
                          setError("");
                        }}
                      />
                    </label>
                    {q.question.allowUnknown !== false && (
                      <label className="premium-option">
                        <input
                          type="checkbox"
                          checked={diagnostic[q.id] === "unknown"}
                          onChange={(e) => {
                            setDiagnostic((d) =>
                              updateCombined(
                                selected,
                                d,
                                q.id,
                                e.target.checked ? "unknown" : "",
                                1,
                              ),
                            );
                            setError("");
                          }}
                        />
                        {t("Not sure", "No sé")}
                      </label>
                    )}
                  </>
                ) : q.question.kind === "state" ? (
                  <label className="premium-field">
                    <span className="visually-hidden">
                      {q.question.label[locale]}
                    </span>
                    <select
                      aria-labelledby="combined-question"
                      value={String(diagnostic[q.id] ?? "")}
                      onChange={(e) => {
                        setDiagnostic((d) =>
                          updateCombined(selected, d, q.id, e.target.value, 1),
                        );
                        setError("");
                      }}
                    >
                      <option value="">
                        {t("Select a state", "Selecciona un estado")}
                      </option>
                      {US_STATES.map((state) => (
                        <option key={state.value} value={state.value}>
                          {state.label}
                        </option>
                      ))}
                      <option value="unknown">{t("Not sure", "No sé")}</option>
                    </select>
                  </label>
                ) : (
                  <fieldset
                    className="premium-options"
                    aria-labelledby="combined-question"
                  >
                    <legend className="visually-hidden">
                      {q.question.label[locale]}
                    </legend>
                    {q.question.options?.map((option) => {
                      const current = diagnostic[q.id],
                        multi = q.question.kind === "multi",
                        checked = multi
                          ? Array.isArray(current) &&
                            current.includes(option.value)
                          : current === option.value;
                      return (
                        <label className="premium-option" key={option.value}>
                          <input
                            type={multi ? "checkbox" : "radio"}
                            name={q.id}
                            checked={checked}
                            onChange={() => {
                              const values = Array.isArray(current)
                                ? current
                                : [];
                              const next = multi
                                ? checked
                                  ? values.filter((v) => v !== option.value)
                                  : ["none", "unknown"].includes(option.value)
                                    ? [option.value]
                                    : [
                                        ...values.filter(
                                          (v) =>
                                            !["none", "unknown"].includes(v),
                                        ),
                                        option.value,
                                      ]
                                : option.value;
                              setDiagnostic((d) =>
                                updateCombined(selected, d, q.id, next, 1),
                              );
                              setError("");
                            }}
                          />
                          <span>{option.label[locale]}</span>
                        </label>
                      );
                    })}
                  </fieldset>
                )}
              </>
            )}
            <div className="premium-question-actions">
              <button
                className="premium-secondary"
                disabled={busy || locked}
                onClick={() => {
                  if(consultationOnly){navigate("/");return;}
                  setStep((s) => s - 1);
                  setError("");
                }}
              >
                {t("Back", "Atrás")}
              </button>
              <button
                className="premium-button"
                disabled={busy}
                onClick={() => void next()}
              >
                {busy
                  ? t("Saving…", "Guardando…")
                  : atContact
                    ? t(
                        locked
                          ? "Retry Save"
                          : consultationOnly ? "Save Details & Choose a Time" : "Save & Reserve My Consultation",
                        locked
                          ? "Reintentar guardado"
                          : "Guardar y reservar mi consulta",
                      )
                    : t("Continue", "Continuar")}{" "}
                ↗
              </button>
            </div>
          </section>
        )}
        {error && (
          <p ref={errorHeading} tabIndex={-1} role="alert" className="premium-error">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
