import { useLocation } from 'react-router-dom'
import DiagnosticLanding from '../../home/DiagnosticLanding'
import SpecializedLocaleSwitcher, { useSpecializedDocumentLang } from '../../assessment/specialized/SpecializedLocaleSwitcher'
import { readSpecializedLocale, withSpecializedLocale } from '../../assessment/specialized/locale'
import { SHORT_CARDS } from '../../../modules/reportCard/shortForm/catalog'
import type { PublicReportCardAssessmentType } from '../../../modules/reportCard/publicIngestCatalog'

export default function ShortLanding({assessmentType}:{assessmentType:PublicReportCardAssessmentType}) {
  const location=useLocation(), locale=readSpecializedLocale(location.search), card=SHORT_CARDS[assessmentType]
  useSpecializedDocumentLang(locale)
  const t=(en:string,es:string)=>locale==='es'?es:en
  const count=card.questions.length+3
  return <DiagnosticLanding
    pageClassName={`${assessmentType}-report-card-page`}
    headerExtra={<SpecializedLocaleSwitcher locale={locale} groupLabel={t('Language','Idioma')} englishLabel="English" spanishLabel="Español"/>}
    eyebrow={t('Your first planning conversation starts here','Tu primera conversación de planificación empieza aquí')}
    title={card.title[locale]}
    heroCopies={[t(`Answer up to ${count} questions, including contact details, for a focused first review.`,`Responde hasta ${count} preguntas, incluyendo datos de contacto, para una primera revisión enfocada.`),t('See observations supported by your answers, information to confirm, and topics for your next conversation.','Conoce observaciones basadas en tus respuestas, información por confirmar y temas para tu próxima conversación.')]}
    ctaLabel={t('Start my short review','Comenzar mi revisión breve')}
    ctaTo={withSpecializedLocale(card.assessmentPath,locale,location.search)}
    heroMicrocopy={t('Phone is optional. Outreach and marketing permissions are optional.','El teléfono es opcional. Los permisos de contacto y marketing son opcionales.')}
    receiveHeading={t('What you receive','Qué recibirás')}
    receiveLead={t('A clear starting point based on what you share.','Un punto de partida claro basado en lo que compartes.')}
    receiveItems={[
      {icon:'priorities',title:t('Review topics','Temas para revisar'),description:t('Observations tied to your reported situation.','Observaciones vinculadas con tu situación reportada.')},
      {icon:'blueprint',title:t('Your answer summary','Resumen de tus respuestas'),description:t('A record you can bring to an advisor conversation.','Un registro que puedes llevar a una conversación con tu asesor.')},
      {icon:'session',title:t('Optional next steps','Próximos pasos opcionales'),description:t('Detailed planning questions are saved for your private intake.','Las preguntas detalladas de planificación se reservan para tu formulario privado.')},
    ]}
    sampleHeading={t('How to read your review','Cómo leer tu revisión')}
    sampleLead={t('This short form provides educational observations, without a letter grade or calibrated readiness score.','Esta evaluación breve ofrece observaciones educativas, sin calificación ni puntaje calibrado.')}
    samplePreview={<div className="crm-panel"><h3>{t('Information to confirm','Información por confirmar')}</h3><p>{t('Example: “Not sure” is recorded as missing information. It is not treated as zero or an established financial problem.','Ejemplo: “No sé” se registra como información por confirmar. No se considera cero ni un problema financiero comprobado.')}</p></div>}
    categoriesHeading={t('What we ask about','Sobre qué preguntamos')}
    categoriesLead={t('Short answers now; supporting details during your private intake.','Respuestas breves ahora; detalles de respaldo durante tu formulario privado.')}
    categories={card.questions.slice(0,6).map(q=>({icon:'blueprint',title:q.label[locale],description:q.unit?.[locale]??t('Choose the answer that best reflects your situation.','Elige la respuesta que mejor refleje tu situación.')}))}
    howHeading={t('How it works','Cómo funciona')}
    howLead={t('Move at your own pace. You can go back before submitting.','Avanza a tu ritmo. Puedes regresar antes de enviar.')}
    howSteps={[
      {step:'1',title:t('Answer','Responde'),description:t('Use “Not sure” when an amount or detail is unknown.','Usa “No sé” cuando desconozcas una cantidad o detalle.')},
      {step:'2',title:t('Save and review','Guarda y revisa'),description:t('Provide your name and email, then review the storage and privacy acknowledgments.','Proporciona tu nombre y correo, y revisa las confirmaciones de almacenamiento y privacidad.')},
      {step:'3',title:t('Choose your next step','Elige tu próximo paso'),description:t('Read your review and decide whether to schedule a conversation.','Lee tu revisión y decide si deseas programar una conversación.')},
    ]}
    faqHeading={t('Before you begin','Antes de comenzar')}
    faqLead={t('A few helpful details.','Algunos detalles útiles.')}
    faqs={[
      {question:t('Will I receive a grade?','¿Recibiré una calificación?'),answer:t('New short-form reviews do not assign numerical scores or letter grades. Previous full-report results remain separate and unchanged.','Las revisiones breves nuevas no asignan puntajes ni calificaciones. Los resultados completos anteriores permanecen separados y sin cambios.')},
      {question:t('Does this approve or qualify me for anything?','¿Esto me aprueba o califica para algo?'),answer:t('No. This educational review cannot establish eligibility, loan approval, coverage needs, or financial outcomes.','No. Esta revisión educativa no determina elegibilidad, aprobación de préstamos, necesidades de cobertura ni resultados financieros.')},
      {question:t('Where do the detailed questions go?','¿Dónde van las preguntas detalladas?'),answer:t('Your advisor’s private intake collects the supporting details needed for a fuller review.','El formulario privado de tu asesor recoge los detalles de respaldo necesarios para una revisión más completa.')},
    ]}
    closingTitle={t('Start with what you know','Comienza con lo que sabes')}
    closingCopy={t('A short review helps organize the next conversation.','Una revisión breve ayuda a organizar la próxima conversación.')}
    closingMicrocopy={t('Educational and based on self-reported information.','Educativo y basado en información proporcionada por ti.')}
  />
}
