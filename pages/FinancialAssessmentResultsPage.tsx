import {readinessRatingLabel} from "../modules/reportCard/readinessRating";
import ReadinessGrade from "../components/premium/ReadinessGrade";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AssessmentBrandHeader from "../components/AssessmentBrandHeader";
import PublicLocaleSwitcher from "../components/publicSite/PublicLocaleSwitcher";
import { readPublicLocale } from "../components/publicSite/locale";
import { usePublicDocumentLang } from "../components/publicSite/usePublicDocumentLang";
import { useHomeDocumentMeta } from "../components/publicSite/home/useHomeDocumentMeta";
import { ShortResultBody } from "../components/reportCard/shortForm/ShortResults";
import TacConsultationBooking from "../components/premium/TacConsultationBooking";
import { requestAssessmentReport } from "../components/premium/requestAssessmentReport";
import {
  isPriority,
  PRIORITIES,
  type Priority,
} from "../modules/reportCard/combined/engine";
import type { adaptiveReportCard, combinedResults } from "../modules/reportCard/combined/results";
import "../components/premium/premium.css";
import "../components/premium/atelier.css";
type Reports = ReturnType<typeof combinedResults>;
export default function FinancialAssessmentResultsPage() {
  const location = useLocation(),
    assessmentId = new URLSearchParams(location.search).get("assessment") ?? "",
    locale = readPublicLocale(location.search),
    es = locale === "es",
    t = (en: string, spanish: string) => (es ? spanish : en);
  usePublicDocumentLang(locale);
  useHomeDocumentMeta({
    metaTitle: t(
      "Your Financial Assessment | Valtoris Financial",
      "Tu evaluación financiera | Valtoris Financial",
    ),
    metaDescription: t(
      "Your private assessment and consultation.",
      "Tu evaluación y consulta privada.",
    ),
  });
  const [selected, setSelected] = useState<Priority[]>(() =>
    Array.isArray(location.state?.selected)
      ? location.state.selected.filter(isPriority)
      : [],
  );
  const [nextSteps,setNextSteps]=useState<{service:string;title:string;text:string}[]>([]);
  const [strategyVersion,setStrategyVersion]=useState<number|null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [confirmationPaused, setConfirmationPaused] = useState(false);
  const [consultationOnly,setConsultationOnly] = useState(false);
  const [preliminary,setPreliminary] = useState<{type:string;verificationLabel:string;coverageStatus:string;actions:{id:string;text:string}[];urgent:{id:string;text:string}[]}[]>([]);
  const [answerRows, setAnswerRows] = useState<
    { id: string; label: string; value: string }[]
  >([]);
  const [reportCard,setReportCard] = useState<ReturnType<typeof adaptiveReportCard>>(null);
  const [reports, setReports] = useState<Reports | null>(null),
    [busy, setBusy] = useState(true),
    [code, setCode] = useState("loading");
  const requestSequence = useRef(0),
    heading = useRef<HTMLHeadingElement>(null);
  const check = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setBusy(true);
    setReports(null);
    setReportCard(null);
    setPreliminary([]);
    setAnswerRows([]);
    try {
      const response = await requestAssessmentReport(
        `/api/ingest-family-report-card?flow=premium&action=report&lang=${locale}&assessment=${encodeURIComponent(assessmentId)}`,
      );
      const data = await response.json();
      if (sequence === requestSequence.current) setStrategyVersion(data.strategyVersion??null);
      if (sequence === requestSequence.current) setConsultationOnly(data.consultationOnly === true);
      if (sequence === requestSequence.current) setPreliminary(Array.isArray(data.preliminary)?data.preliminary:[]);
      if (sequence !== requestSequence.current) return;
      if (Array.isArray(data.selected))
        setSelected(data.selected.filter(isPriority));
      if (response.ok && data.ok && Array.isArray(data.results)) {
        setReports(data.results);
        setNextSteps(Array.isArray(data.nextSteps)?data.nextSteps:[]);
        setReportCard(data.financialReportCard??null);
        setAnswerRows(Array.isArray(data.answerRows) ? data.answerRows : []);
        setCode("ready");
        setAwaitingConfirmation(false);
        setConfirmationPaused(false);
      } else {
        setReports(null);
        setCode(
          typeof data.code === "string"
            ? data.code
            : "verification_unavailable",
        );
      }
    } catch {
      if (sequence === requestSequence.current)
        setCode("verification_unavailable");
    } finally {
      if (sequence === requestSequence.current) setBusy(false);
    }
  }, [locale, assessmentId]);
  useEffect(() => {
    void check();
  }, [check]);
  useEffect(() => {
    if (reports) heading.current?.focus();
  }, [reports]);
  const needsSession = [
    "assessment_session_required",
    "assessment_not_found",
  ].includes(code);
  useEffect(() => {
    if (!awaitingConfirmation || reports || needsSession) return;
    let disposed = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await check();
      if (disposed) return;
      attempts += 1;
      if (attempts < 20) timer = setTimeout(() => void poll(), 3000);
      else { setAwaitingConfirmation(false); setConfirmationPaused(true); }
    };
    timer = setTimeout(() => void poll(), 1000);
    return () => { disposed = true; clearTimeout(timer); };
  }, [awaitingConfirmation, reports, needsSession, check]);
  return (
    <main className="premium-results">
      <header className="premium-assessment-header">
        <AssessmentBrandHeader />
        <PublicLocaleSwitcher
          locale={locale}
          groupLabel={t("Language", "Idioma")}
          englishLabel="English"
          spanishLabel="Español"
        />
      </header>
      <div className="premium-results-inner">
        {reports ? (
          <>
            <p className="premium-kicker">
              {t("YOUR FINANCIAL PERSPECTIVE", "TU PERSPECTIVA FINANCIERA")}
            </p>
            <h1 ref={heading} tabIndex={-1}>
              {t(
                consultationOnly ? "Your Consultation Is Confirmed." : "A Clearer View of What Comes Next.",
                consultationOnly ? "Tu consulta está confirmada." : "Una visión más clara de lo que sigue.",
              )}
            </h1>
            <p className="premium-lead">
              {t(
                consultationOnly ? "Your consultation is booked. We’ll discuss your priorities and complete your financial intake together. No Report Card has been completed." : "Use these educational results to organize your questions. Book your complimentary consultation below; further discovery is optional.",
                consultationOnly ? "Tu consulta está reservada. Conversaremos sobre tus prioridades y completaremos la información financiera juntos. No se ha completado un Report Card." : "Usa estos resultados educativos para organizar tus preguntas. Reserva tu consulta sin costo abajo; la revisión adicional es opcional.",
              )}
            </p>
            {strategyVersion===1 && <section className="premium-report"><h2>{t('Book Your Complimentary Consultation','Reserva tu consulta sin costo')}</h2><TacConsultationBooking assessmentId={assessmentId} locale={locale} onBooked={()=>void check()} /><h2>{t('Optional: Discover Your Bigger Financial Picture','Opcional: descubre tu panorama financiero')}</h2><p>{t('Your results and booking are available now. Continue with Family or Business Owner discovery if you wish. Prior answers carry forward; no duplicate questions.','Tus resultados y reserva están disponibles. Continúa con la revisión familiar o empresarial si deseas. Conservamos tus respuestas sin repetir preguntas.')}</p><Link className="premium-secondary" to={`/comprehensive-discovery?assessment=${assessmentId}&scope=family&lang=${locale}`}>{t('Family Financial Report Card','Report Card Financiero Familiar')}</Link>{' '}<Link className="premium-secondary" to={`/comprehensive-discovery?assessment=${assessmentId}&scope=business&lang=${locale}`}>{t('Business Owner Financial Report Card','Report Card Financiero Empresarial')}</Link></section>}
            {reportCard && <section className="adaptive-report-card"><h2>{t('Financial Report Card','Report Card Financiero')}</h2><strong>{strategyVersion===1?readinessRatingLabel(reportCard.rating,locale):reportCard.overall.grade??t('Needs review','Requiere revisión')}{reportCard.overall.score!==null?` · ${reportCard.overall.score}/100`:''}</strong><p>{t('Preliminary — self-reported planning readiness.','Preliminar — preparación de planificación autodeclarada.')}</p><p>{reportCard.overall.known}/{reportCard.overall.total} {t('selected categories have evidence. Missing evidence needs review.','categorías seleccionadas tienen información. La información faltante requiere revisión.')}</p><p>{t('Rubric: current/reviewed = 100, partial = 50, not addressed = 0. Unknown is unscored. The preliminary grade uses known readiness checks only; missing information is flagged separately and can change the grade. These brief checks do not establish coverage adequacy, loan eligibility or financial health.','Rúbrica: actual/revisado = 100, parcial = 50, no atendido = 0. Lo desconocido no se puntúa. La nota preliminar usa solo las verificaciones conocidas; la información faltante se marca aparte y puede cambiar la nota. Estas preguntas no determinan suficiencia de cobertura, elegibilidad ni salud financiera.')}</p></section>}
            {nextSteps.length>0&&<section className="premium-report"><h2>{t("Your Next Steps","Tus próximos pasos")}</h2>{nextSteps.map(item=><p key={item.service}><strong>{item.title}</strong>: {item.text}</p>)}</section>}
            {reports.map((review) => (
              <section className="premium-report" key={review.type}>
                <h2>{review.title}</h2>
                {review.kind === "adaptive" ? <div><strong>{strategyVersion===1?readinessRatingLabel(review.result.rating,locale):review.result.grade??t('Needs review','Requiere revisión')}{review.result.score!==null?` · ${review.result.score}/100`:''}</strong><p>{review.result.status==='needs-review'?t('Preliminary / needs review — limited or missing evidence.','Preliminar / requiere revisión — información limitada o faltante.'):t('Preliminary — confirm with records and your advisor.','Preliminar — confirmar con registros y tu asesor.')}</p><p>{review.result.known}/{review.result.total} {t('planning checks answered; review current records during your consultation.','verificaciones respondidas; revisa registros actuales durante tu consulta.')}</p></div> : review.kind === "short" ? (
                  <>
                    <ShortResultBody result={review.result} locale={locale} />
                    {review.type === "home_buyer" && (
                      <p>
                        {t(
                          "When appropriate, a real estate professional can participate through a partnership. No referral or application has been submitted.",
                          "Cuando corresponda, un profesional de bienes raíces puede participar mediante una colaboración. No se ha enviado referencia ni solicitud.",
                        )}
                      </p>
                    )}
                  </>
                ) : review.kind === "lifestyle" ? (
                  <>
                    <p>{review.result.summary}</p>
                    <h3>{t("Reported", "Lo que informaste")}</h3>
                    <dl>{review.result.reported?.map(row => <div key={row.id}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
                    <h3>{t("Needs confirmation", "Por confirmar")}</h3>
                    <p>{t("Current policy terms, limits, and dates need document verification.", "Los términos, límites y fechas requieren verificación con documentos.")}</p>
                    <ul>{review.result.confirm?.map(row => <li key={row.id}>{row.label}</li>)}</ul>
                    <h3>{t("Discuss with your advisor", "Para conversar con tu asesor")}</h3>
                    <ul>{review.result.topics?.map(topic => <li key={topic.id}>{topic.text}</li>)}</ul>
                    <p>{t("Prepare current policy summaries and renewal notices for your consultation. Your advisor will explain how to share documents securely.", "Prepara resúmenes de pólizas y avisos de renovación para tu consulta. Tu asesor explicará cómo compartir documentos de forma segura.")}</p>
                  </>
                ) : (
                  <>
                    {review.result.coverageReview && <section className="premium-grade"><h3>{t("Coverage review", "Revisión de cobertura")}</h3><p>{review.result.coverageReview.coverageStatus}</p><p>{review.result.coverageReview.verificationLabel}</p><h3>{t("Decision readiness", "Preparación para decidir")}</h3><p>{review.result.coverageReview.readiness.known} / {review.result.coverageReview.readiness.total} {t("answers known; remaining information needs confirmation.", "respuestas conocidas; falta confirmar información.")}</p>{review.result.coverageReview.dates.map(d=><p key={d.id}>{d.id==='renewal_date'?t('Renewal date','Fecha de renovación'):t('Coverage change date','Fecha de cambio')}: {d.date}</p>)}<h3>{t("Your three next actions", "Tus tres próximos pasos")}</h3><ol>{review.result.coverageReview.actions.map(a=><li key={a.id}>{a.text}</li>)}</ol></section>}
                    <div className="premium-grade">
                      <p>
                        {t(
                          "Educational planning-preparation grade",
                          "Calificación educativa de preparación",
                        )}
                      </p>
                      <strong>
                        {review.result.grade.notApplicable
                          ? t("Not applicable", "No aplica")
                          : review.result.grade.provisional
                            ? t(
                                "Preliminary — information to confirm",
                                "Preliminar — información por confirmar",
                              )
                            : `${review.result.overallGrade ?? "—"}${review.result.overallScore !== null ? ` · ${review.result.overallScore}/100` : ""}`}
                      </strong>
                      <p>
                        {t(
                          "This describes limited preparation checks. It does not establish coverage adequacy, eligibility, tax savings, investment performance or financial health.",
                          "Describe verificaciones limitadas de preparación. No establece suficiencia de cobertura, elegibilidad, ahorro fiscal, rendimiento ni salud financiera.",
                        )}
                      </p>
                    </div>
                    {review.result.critical.length > 0 && (
                      <aside>
                        <h3>{t("Needs attention", "Requiere atención")}</h3>
                        {review.result.critical.map((item) => (
                          <p key={item.id}>{item.detail}</p>
                        ))}
                      </aside>
                    )}
                    <h3>
                      {t(
                        "Topics for your consultation",
                        "Temas para tu consulta",
                      )}
                    </h3>
                    {review.result.priorities.map((item, index) => (
                      <article key={index}>
                        <h4>{item.title}</h4>
                        <p>{item.why}</p>
                      </article>
                    ))}
                    {review.result.pathways.map((path) => (
                      <article key={path.id}>
                        <h3>{path.title[locale]}</h3>
                        <p>{path.detail[locale]}</p>
                      </article>
                    ))}
                    {review.type === "benefits" && review.result.grade.notApplicable && <p>{t("You reported no W-2 employees. Workforce-benefits checks do not apply. Discuss personal coverage or revisit this review when you hire employees.", "Informaste que no tienes empleados W-2. No aplican las verificaciones de beneficios del equipo. Revisa cobertura personal o vuelve cuando contrates empleados.")}</p>}
                    {review.type === "benefits" && !review.result.grade.notApplicable && <section><h3>{t("Documents to prepare", "Documentos para preparar")}</h3><ul>{(locale === "es" ? ["Resumen de beneficios y renovación actual", "Resumen agregado de nómina y número de empleados", "Aportación mensual del empleador por empleado", "Contacto de nómina y responsable de beneficios"] : ["Current benefits summary and renewal information", "Aggregate payroll summary and employee counts", "Employer monthly contribution per employee", "Payroll contact and benefits decision-maker"]).map(item => <li key={item}>{item}</li>)}</ul><p>{t("Bring summaries to your consultation. Request secure census instructions later; do not email or upload employee names, diagnoses, Social Security numbers or employee-level census data through this review.", "Lleva resúmenes a tu consulta. Solicita después instrucciones seguras para el censo; no envíes nombres, diagnósticos, números de Seguro Social ni datos individuales de empleados mediante esta revisión.")}</p><h3>{t("Next steps", "Próximos pasos")}</h3><p>{t("Confirm missing information at your consultation. If appropriate, Valtoris can coordinate an employer-specific analysis with DCBG. Preliminary discussion relevance is separate from your preparation grade; only the partner can confirm program fit and proposal terms.", "Confirma la información pendiente en tu consulta. Si corresponde, Valtoris puede coordinar un análisis específico con DCBG. La relevancia preliminar es independiente de tu calificación de preparación; solo el socio confirma compatibilidad y términos.")}</p></section>}
                    {review.note && <p>{review.note}</p>}
                    {review.sources.length > 0 && (
                      <details>
                        <summary>
                          {t("Reference resources", "Recursos de referencia")}
                        </summary>
                        {review.sources.map((source) => (
                          <p key={source.url}>
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {source.label} ↗
                            </a>
                          </p>
                        ))}
                      </details>
                    )}
                    {review.result.unknown.length > 0 && (
                      <details>
                        <summary>
                          {t(
                            "Information to confirm",
                            "Información por confirmar",
                          )}
                        </summary>
                        {review.result.unknown.map((item) => (
                          <p key={item.id}>
                            {item.label}: {item.next}
                          </p>
                        ))}
                      </details>
                    )}
                    <details>
                      <summary>
                        {t(
                          "How this grade works",
                          "Cómo funciona esta calificación",
                        )}
                      </summary>
                      {review.result.grade.measures.map((measure) => (
                        <p key={measure.id}>
                          <strong>{measure.label[locale]}</strong>:{" "}
                          {measure.score ?? t("Unscored", "Sin puntuar")} ·{" "}
                          {measure.rule[locale]}
                        </p>
                      ))}
                    </details>
                  </>
                )}
              </section>
            ))}
            {reportCard && strategyVersion===1 && <ReadinessGrade rating={reportCard.rating} locale={locale}/>}
            <button className="premium-button" onClick={() => window.print()}>{t(consultationOnly ? "Print Confirmation" : "Print / Save as PDF", consultationOnly ? "Imprimir confirmación" : "Imprimir / Guardar PDF")}</button>
            {answerRows.length > 0 && (
              <details className="premium-report">
                <summary>
                  {t("Your submitted answers", "Tus respuestas enviadas")}
                </summary>
                <dl>
                  {answerRows.map((row) => (
                    <div key={row.id}>
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
            <p className="premium-fineprint">
              {t(
                "Each grade describes self-reported planning preparation using the rubric shown above. No quote, enrollment, rollover, loan application or real estate transaction has been submitted.",
                "Cada nota describe la preparación autodeclarada según la rúbrica mostrada arriba. No se ha enviado cotización, inscripción, transferencia, solicitud de préstamo ni transacción inmobiliaria.",
              )}
            </p>
          </>
        ) : (
          <section className="premium-saved">
            <p className="premium-kicker">
              {needsSession
                ? t("YOUR NEXT STEP", "TU SIGUIENTE PASO")
                : t(
                    "YOUR REVIEW · YOUR NEXT CONVERSATION",
                    "TU REVISIÓN · TU PRÓXIMA CONVERSACIÓN",
                  )}
            </p>
            <h1>
              {needsSession
                ? t(
                    "Begin With Your Priorities.",
                    "Empieza con tus prioridades.",
                  )
                : t(
                    "Reserve a Time for What Matters.",
                    "Reserva tiempo para lo que importa.",
                  )}
            </h1>
            <p>
              {needsSession
                ? t(
                    "Start a financial assessment to prepare your review and consultation. For your privacy, detailed results require the secure session used to complete your assessment.",
                    "Comienza una evaluación financiera para preparar tu revisión y consulta. Por tu privacidad, los resultados detallados requieren la sesión segura utilizada para completar la evaluación.",
                  )
                : t(
                    consultationOnly ? "Your contact details are saved. Choose a time below for your complimentary consultation." : "Book your complimentary initial consultation to unlock your detailed Report Cards. We use your saved assessment details for this reservation.",
                    "Reserva tu consulta inicial sin costo para desbloquear tus Report Cards detallados. Usaremos los datos guardados en tu evaluación para esta reserva.",
                  )}
            </p>
            {selected.length > 0 && (
              <>
                <h2>
                  {t("Your selected review areas", "Tus áreas seleccionadas")}
                </h2>
                <ul>
                  {selected.map((type) => (
                    <li key={type}>
                      {PRIORITIES.find((p) => p.id === type)![locale]}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {preliminary.map(review=><section className="premium-grade" key={review.type}><h2>{review.type==='health'?t('Your preliminary health findings','Tus observaciones preliminares de salud'):t('Your preliminary benefits findings','Tus observaciones preliminares de beneficios')}</h2><p>{review.coverageStatus}</p><p>{review.verificationLabel}</p>{review.urgent.length>0&&<aside><h3>{t('Needs attention','Requiere atención')}</h3>{review.urgent.map(a=><p key={a.id}>{a.text}</p>)}</aside>}<ol>{review.actions.map(a=><li key={a.id}>{a.text}</li>)}</ol></section>)}
            {code === "booking_required" && (
              <>
                <p>
                  {t(
                    consultationOnly ? "Choose an available time, then confirm your consultation." : "Your assessment is saved. Book a consultation to open your detailed Report Cards and review your priorities together.",
                    "Tu evaluación está guardada. Reserva una consulta para abrir tus informes detallados y revisar tus prioridades juntos.",
                  )}
                </p>
                <TacConsultationBooking consultationOnly={consultationOnly} assessmentId={assessmentId} locale={locale} onBooked={() => void check()} onReservationPending={() => { setConfirmationPaused(false); setAwaitingConfirmation(true); }} />

              </>
            )}
            <div role="status" aria-live="polite">
              {confirmationPaused && <p>{t("Confirmation is taking longer than expected. Try again below to check your existing reservation; no second booking is needed.", "La confirmación está tardando más de lo esperado. Intenta de nuevo abajo para verificar tu reserva existente; no necesitas otra cita.")}</p>}
              {awaitingConfirmation && <p>{t("Your reservation is being confirmed. Your results will open automatically once it is verified.", "Tu reserva se está confirmando. Tus resultados se abrirán automáticamente cuando se verifique.")}</p>}
              <p>
                {busy
                  ? t(
                      "Checking your saved assessment and appointment.",
                      "Verificando tu evaluación y cita.",
                    )
                  : code === "booking_required"
                    ? t(
                        consultationOnly ? "Your contact details are saved. Choose a time above and confirm your consultation." : "Your assessment is saved. Choose a consultation time above. Your detailed results open automatically after your reservation is confirmed.",
                        "Tu evaluación está guardada. Elige un horario arriba. Tus resultados detallados se abren automáticamente después de confirmar tu reserva.",
                      )
                    : needsSession
                      ? ""
                      : t(
                          "We could not check your saved assessment and appointment right now. Try again below; you do not need to repeat your Report Card. Your detailed results remain protected.",
                          "No pudimos verificar tu evaluación guardada y cita ahora. Intenta de nuevo abajo; no necesitas repetir tu Report Card. Tus resultados detallados permanecen protegidos.",
                        )}
              </p>
            </div>
            {!needsSession && (code !== "booking_required" || confirmationPaused) && (
              <button
                className="premium-secondary"
                disabled={busy}
                onClick={() => {
                  if (confirmationPaused) { setConfirmationPaused(false); setAwaitingConfirmation(true); }
                  void check();
                }}
              >
                {busy
                  ? t("Checking…", "Verificando…")
                  : t("Try Again — Check My Saved Assessment", "Intentar de nuevo — verificar mi evaluación guardada")}
              </button>
            )}
            {needsSession && (
              <Link
                className="premium-button"
                to={`/financial-assessment${locale === "es" ? "?lang=es" : ""}`}
              >
                {t("Begin My Assessment", "Comenzar mi evaluación")}
              </Link>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
