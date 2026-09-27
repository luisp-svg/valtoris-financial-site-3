import type { PublicReportCardAssessmentType } from '../publicIngestCatalog.js'
export type Locale = 'en' | 'es'
export type Copy = Record<Locale, string>
export type ShortQuestion = { id: string; label: Copy; kind: 'number' | 'select' | 'multi' | 'state'; options?: readonly { value: string; label: Copy }[]; unit?: Copy; max?: number; when?: { field: string; not: string } }
export type ShortCard = { title: Copy; assessmentPath: string; storageKey: string; questions: readonly ShortQuestion[] }
/** Version 3 avoids the deployed Home Buyer v2 contract. Legacy versions remain immutable. */
export const SHORT_FORM_VERSION = 3
export const SHORT_FORM_FORMAT = 'short-form-v3' as const
export const SHORT_CARDS: Record<PublicReportCardAssessmentType, ShortCard> = {
  "family": {
    "title": {
      "en": "Family Report Card",
      "es": "Reporte Familiar"
    },
    "assessmentPath": "/family-assessment",
    "storageKey": "valtoris-demo-answers",
    "questions": [
      {
        "id": "age",
        "label": {
          "en": "How old are you?",
          "es": "¿Cuántos años tienes?"
        },
        "kind": "number",
        "max": 110
      },
      {
        "id": "dependents",
        "label": {
          "en": "How many people depend on your income?",
          "es": "¿Cuántas personas dependen de tus ingresos?"
        },
        "kind": "number",
        "max": 50
      },
      {
        "id": "income",
        "label": {
          "en": "About how much does your household earn annually, before taxes?",
          "es": "¿Cuánto gana tu hogar al año, antes de impuestos?"
        },
        "kind": "number",
        "unit": {
          "en": "USD",
          "es": "USD"
        }
      },
      {
        "id": "housing",
        "label": {
          "en": "What is your monthly housing payment?",
          "es": "¿Cuánto pagas por vivienda al mes?"
        },
        "kind": "number",
        "unit": {
          "en": "USD/month",
          "es": "USD/mes"
        }
      },
      {
        "id": "debt",
        "label": {
          "en": "About how much non-mortgage debt does your household owe?",
          "es": "¿Cuánta deuda tiene tu hogar, sin incluir la hipoteca?"
        },
        "kind": "number",
        "unit": {
          "en": "USD",
          "es": "USD"
        }
      },
      {
        "id": "reserves",
        "label": {
          "en": "How many months of essential expenses could your savings cover?",
          "es": "¿Cuántos meses de gastos esenciales cubren tus ahorros?"
        },
        "kind": "number",
        "max": 120
      },
      {
        "id": "cash_flow",
        "label": {
          "en": "After regular bills, do you usually save money, break even, or fall short?",
          "es": "Después de pagar tus gastos, ¿ahorras, quedas sin sobrante o te falta dinero?"
        },
        "kind": "select",
        "options": [
          {
            "value": "positive",
            "label": {
              "en": "Usually save money",
              "es": "Normalmente ahorro"
            }
          },
          {
            "value": "break_even",
            "label": {
              "en": "Usually break even",
              "es": "Normalmente quedo sin sobrante"
            }
          },
          {
            "value": "negative",
            "label": {
              "en": "Usually fall short",
              "es": "Normalmente me falta dinero"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "saving_rate",
        "label": {
          "en": "About what percentage of income do you save for retirement?",
          "es": "¿Qué porcentaje de tus ingresos ahorras para la jubilación?"
        },
        "kind": "number",
        "unit": {
          "en": "% of income",
          "es": "% de ingresos"
        },
        "max": 100
      },
      {
        "id": "coverage",
        "label": {
          "en": "How much life insurance coverage do you currently have?",
          "es": "¿Cuánta cobertura de seguro de vida tienes?"
        },
        "kind": "number",
        "unit": {
          "en": "USD",
          "es": "USD"
        }
      },
      {
        "id": "disability",
        "label": {
          "en": "Do you have coverage that could replace income if you cannot work?",
          "es": "¿Tienes cobertura que reemplace tus ingresos si no puedes trabajar?"
        },
        "kind": "select",
        "options": [
          {
            "value": "yes",
            "label": {
              "en": "Yes",
              "es": "Sí"
            }
          },
          {
            "value": "no",
            "label": {
              "en": "No",
              "es": "No"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "documents",
        "label": {
          "en": "Which family-protection documents are current?",
          "es": "¿Qué documentos de protección familiar están actualizados?"
        },
        "kind": "multi",
        "options": [
          {
            "value": "will",
            "label": {
              "en": "Will",
              "es": "Testamento"
            }
          },
          {
            "value": "trust",
            "label": {
              "en": "Trust",
              "es": "Fideicomiso"
            }
          },
          {
            "value": "beneficiaries",
            "label": {
              "en": "Beneficiaries reviewed",
              "es": "Beneficiarios revisados"
            }
          },
          {
            "value": "guardian",
            "label": {
              "en": "Guardian plan, if applicable",
              "es": "Plan de tutor, si corresponde"
            }
          },
          {
            "value": "poa",
            "label": {
              "en": "Power of attorney",
              "es": "Poder legal"
            }
          },
          {
            "value": "none",
            "label": {
              "en": "None current",
              "es": "Ninguno actualizado"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "priority",
        "label": {
          "en": "What is your main financial priority?",
          "es": "¿Cuál es tu principal prioridad financiera?"
        },
        "kind": "select",
        "options": [
          {
            "value": "cash_flow",
            "label": {
              "en": "Monthly cash flow",
              "es": "Flujo mensual"
            }
          },
          {
            "value": "debt",
            "label": {
              "en": "Debt",
              "es": "Deudas"
            }
          },
          {
            "value": "protection",
            "label": {
              "en": "Family protection",
              "es": "Protección familiar"
            }
          },
          {
            "value": "retirement",
            "label": {
              "en": "Retirement",
              "es": "Jubilación"
            }
          },
          {
            "value": "estate",
            "label": {
              "en": "Estate planning",
              "es": "Planificación patrimonial"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      }
    ]
  },
  "business": {
    "title": {
      "en": "Business Report Card",
      "es": "Reporte de Negocio"
    },
    "assessmentPath": "/business-assessment",
    "storageKey": "valtoris-business-answers",
    "questions": [
      {
        "id": "industry",
        "label": {
          "en": "What type of business do you operate?",
          "es": "¿Qué tipo de negocio tienes?"
        },
        "kind": "select",
        "options": [
          {
            "value": "services",
            "label": {
              "en": "Services",
              "es": "Servicios"
            }
          },
          {
            "value": "retail",
            "label": {
              "en": "Retail / ecommerce",
              "es": "Ventas / comercio electrónico"
            }
          },
          {
            "value": "construction",
            "label": {
              "en": "Construction / trades",
              "es": "Construcción / oficios"
            }
          },
          {
            "value": "food",
            "label": {
              "en": "Food / hospitality",
              "es": "Comida / hospitalidad"
            }
          },
          {
            "value": "other",
            "label": {
              "en": "Other",
              "es": "Otro"
            }
          }
        ]
      },
      {
        "id": "years",
        "label": {
          "en": "How many years has it been operating?",
          "es": "¿Cuántos años lleva operando?"
        },
        "kind": "number",
        "max": 200
      },
      {
        "id": "revenue",
        "label": {
          "en": "About how much annual revenue does it generate?",
          "es": "¿Cuántos ingresos brutos genera al año?"
        },
        "kind": "number",
        "unit": {
          "en": "USD",
          "es": "USD"
        }
      },
      {
        "id": "cash_flow",
        "label": {
          "en": "Is operating cash flow usually positive, break-even, or negative?",
          "es": "¿El flujo operativo suele ser positivo, equilibrado o negativo?"
        },
        "kind": "select",
        "options": [
          {
            "value": "positive",
            "label": {
              "en": "Usually save money",
              "es": "Normalmente ahorro"
            }
          },
          {
            "value": "break_even",
            "label": {
              "en": "Usually break even",
              "es": "Normalmente quedo sin sobrante"
            }
          },
          {
            "value": "negative",
            "label": {
              "en": "Usually fall short",
              "es": "Normalmente me falta dinero"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "reserves",
        "label": {
          "en": "How many months of business expenses could reserves cover?",
          "es": "¿Cuántos meses de gastos del negocio cubren las reservas?"
        },
        "kind": "number",
        "max": 120
      },
      {
        "id": "structure",
        "label": {
          "en": "How is the business legally structured?",
          "es": "¿Cuál es la estructura legal del negocio?"
        },
        "kind": "select",
        "options": [
          {
            "value": "sole",
            "label": {
              "en": "Sole proprietor",
              "es": "Propietario único"
            }
          },
          {
            "value": "llc",
            "label": {
              "en": "LLC",
              "es": "LLC"
            }
          },
          {
            "value": "partnership",
            "label": {
              "en": "Partnership",
              "es": "Sociedad"
            }
          },
          {
            "value": "corporation",
            "label": {
              "en": "Corporation",
              "es": "Corporación"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "separation",
        "label": {
          "en": "Are business and personal finances kept separate?",
          "es": "¿Mantienes separadas las finanzas personales y del negocio?"
        },
        "kind": "select",
        "options": [
          {
            "value": "yes",
            "label": {
              "en": "Yes",
              "es": "Sí"
            }
          },
          {
            "value": "no",
            "label": {
              "en": "No",
              "es": "No"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "tax_review",
        "label": {
          "en": "When was your business tax plan last reviewed?",
          "es": "¿Cuándo se revisó por última vez el plan fiscal del negocio?"
        },
        "kind": "select",
        "options": [
          {
            "value": "year",
            "label": {
              "en": "Within the last year",
              "es": "En el último año"
            }
          },
          {
            "value": "older",
            "label": {
              "en": "More than a year ago",
              "es": "Hace más de un año"
            }
          },
          {
            "value": "never",
            "label": {
              "en": "Never",
              "es": "Nunca"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "continuity",
        "label": {
          "en": "Could the business continue for 90 days without its main owner?",
          "es": "¿Podría funcionar el negocio durante 90 días sin su dueño principal?"
        },
        "kind": "select",
        "options": [
          {
            "value": "yes",
            "label": {
              "en": "Yes",
              "es": "Sí"
            }
          },
          {
            "value": "no",
            "label": {
              "en": "No",
              "es": "No"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "protections",
        "label": {
          "en": "Which business protections have been reviewed recently?",
          "es": "¿Qué protecciones del negocio se revisaron recientemente?"
        },
        "kind": "multi",
        "options": [
          {
            "value": "liability",
            "label": {
              "en": "Liability insurance",
              "es": "Seguro de responsabilidad"
            }
          },
          {
            "value": "property",
            "label": {
              "en": "Property insurance",
              "es": "Seguro de propiedad"
            }
          },
          {
            "value": "key_person",
            "label": {
              "en": "Coverage for loss of a key person",
              "es": "Cobertura por pérdida de una persona clave"
            }
          },
          {
            "value": "buy_sell",
            "label": {
              "en": "Funded ownership-transfer agreement",
              "es": "Acuerdo de transferencia de propiedad financiado"
            }
          },
          {
            "value": "none",
            "label": {
              "en": "None reviewed",
              "es": "Ninguna revisada"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "saving_rate",
        "label": {
          "en": "What percentage of personal income do you save outside the business for retirement?",
          "es": "¿Qué porcentaje de tus ingresos personales ahorras fuera del negocio para la jubilación?"
        },
        "kind": "number",
        "unit": {
          "en": "% of income",
          "es": "% de ingresos"
        },
        "max": 100
      },
      {
        "id": "priority",
        "label": {
          "en": "What is your most important business financial goal?",
          "es": "¿Cuál es tu principal meta financiera para el negocio?"
        },
        "kind": "select",
        "options": [
          {
            "value": "cash_flow",
            "label": {
              "en": "Improve cash flow",
              "es": "Mejorar el flujo de efectivo"
            }
          },
          {
            "value": "protection",
            "label": {
              "en": "Protect the business",
              "es": "Proteger el negocio"
            }
          },
          {
            "value": "growth",
            "label": {
              "en": "Fund growth",
              "es": "Financiar el crecimiento"
            }
          },
          {
            "value": "retirement",
            "label": {
              "en": "Build retirement savings",
              "es": "Ahorrar para la jubilación"
            }
          },
          {
            "value": "exit",
            "label": {
              "en": "Plan an eventual exit",
              "es": "Planificar una salida futura"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      }
    ]
  },
  "protection": {
    "title": {
      "en": "Protection Review",
      "es": "Revisión de Protección"
    },
    "assessmentPath": "/protection-gap",
    "storageKey": "valtoris-protection-calculator",
    "questions": [
      {
        "id": "age",
        "label": {
          "en": "How old are you?",
          "es": "¿Cuántos años tienes?"
        },
        "kind": "number",
        "max": 110
      },
      {
        "id": "state",
        "label": {
          "en": "In which state do you live?",
          "es": "¿En qué estado vives?"
        },
        "kind": "state"
      },
      {
        "id": "marital",
        "label": {
          "en": "What is your marital or partnership status?",
          "es": "¿Cuál es tu estado civil o de pareja?"
        },
        "kind": "select",
        "options": [
          {
            "value": "single",
            "label": {
              "en": "Single",
              "es": "Soltero/a"
            }
          },
          {
            "value": "married",
            "label": {
              "en": "Married",
              "es": "Casado/a"
            }
          },
          {
            "value": "partner",
            "label": {
              "en": "Partnered",
              "es": "En pareja"
            }
          },
          {
            "value": "divorced",
            "label": {
              "en": "Divorced",
              "es": "Divorciado/a"
            }
          },
          {
            "value": "widowed",
            "label": {
              "en": "Widowed",
              "es": "Viudo/a"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "children",
        "label": {
          "en": "How many children depend on you?",
          "es": "¿Cuántos hijos dependen de ti?"
        },
        "kind": "number",
        "max": 30
      },
      {
        "id": "income",
        "label": {
          "en": "How much annual household income would need replacing, including housing costs?",
          "es": "¿Cuántos ingresos anuales del hogar habría que reemplazar, incluyendo vivienda?"
        },
        "kind": "number",
        "unit": {
          "en": "USD",
          "es": "USD"
        }
      },
      {
        "id": "years",
        "label": {
          "en": "For how many years would you want that income replaced?",
          "es": "¿Por cuántos años quisieras reemplazar esos ingresos?"
        },
        "kind": "number",
        "max": 60
      },
      {
        "id": "housing",
        "label": {
          "en": "What is your monthly housing cost?",
          "es": "¿Cuál es tu gasto mensual de vivienda?"
        },
        "kind": "number",
        "unit": {
          "en": "USD/month",
          "es": "USD/mes"
        }
      },
      {
        "id": "debt",
        "label": {
          "en": "How much other debt would you want paid off?",
          "es": "¿Cuánta deuda adicional quisieras liquidar?"
        },
        "kind": "number",
        "unit": {
          "en": "USD",
          "es": "USD"
        }
      },
      {
        "id": "education",
        "label": {
          "en": "What total education amount would you want set aside?",
          "es": "¿Qué cantidad total quisieras reservar para educación?"
        },
        "kind": "number",
        "unit": {
          "en": "USD",
          "es": "USD"
        },
        "when": {
          "field": "children",
          "not": "0"
        }
      },
      {
        "id": "final_expenses",
        "label": {
          "en": "What amount would you want reserved for final expenses?",
          "es": "¿Cuánto quisieras reservar para gastos finales?"
        },
        "kind": "number",
        "unit": {
          "en": "USD",
          "es": "USD"
        }
      },
      {
        "id": "coverage",
        "label": {
          "en": "How much life insurance do you already have?",
          "es": "¿Cuánto seguro de vida tienes actualmente?"
        },
        "kind": "number",
        "unit": {
          "en": "USD",
          "es": "USD"
        }
      }
    ]
  },
  "student_loan": {
    "title": {
      "en": "Student Loan Report Card",
      "es": "Reporte de Préstamos Estudiantiles"
    },
    "assessmentPath": "/student-loan-assessment",
    "storageKey": "valtoris-student-loan-answers",
    "questions": [
      {
        "id": "loan_types",
        "label": {
          "en": "Which types of student loans do you have?",
          "es": "¿Qué tipos de préstamos estudiantiles tienes?"
        },
        "kind": "multi",
        "options": [
          {
            "value": "federal",
            "label": {
              "en": "Federal",
              "es": "Federales"
            }
          },
          {
            "value": "private",
            "label": {
              "en": "Private",
              "es": "Privados"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "balance",
        "label": {
          "en": "About how much do you owe in total?",
          "es": "¿Cuánto debes en total?"
        },
        "kind": "number",
        "unit": {
          "en": "USD",
          "es": "USD"
        }
      },
      {
        "id": "status",
        "label": {
          "en": "What is your current loan status?",
          "es": "¿Cuál es el estado actual de tus préstamos?"
        },
        "kind": "select",
        "options": [
          {
            "value": "repayment",
            "label": {
              "en": "Repayment",
              "es": "En pago"
            }
          },
          {
            "value": "school",
            "label": {
              "en": "In school / grace period",
              "es": "Estudiando / período de gracia"
            }
          },
          {
            "value": "paused",
            "label": {
              "en": "Payments paused",
              "es": "Pagos pausados"
            }
          },
          {
            "value": "delinquent",
            "label": {
              "en": "Past due",
              "es": "Atrasados"
            }
          },
          {
            "value": "default",
            "label": {
              "en": "Default",
              "es": "Incumplimiento"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "plan",
        "label": {
          "en": "Which repayment plan are you on?",
          "es": "¿En qué plan de pago estás?"
        },
        "kind": "select",
        "options": [
          {
            "value": "standard",
            "label": {
              "en": "Standard",
              "es": "Estándar"
            }
          },
          {
            "value": "income",
            "label": {
              "en": "Income-driven",
              "es": "Según ingresos"
            }
          },
          {
            "value": "graduated",
            "label": {
              "en": "Graduated / extended",
              "es": "Gradual / extendido"
            }
          },
          {
            "value": "private",
            "label": {
              "en": "Private-lender plan",
              "es": "Plan de prestamista privado"
            }
          },
          {
            "value": "other",
            "label": {
              "en": "Other",
              "es": "Otro"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "income",
        "label": {
          "en": "About how much is your annual income?",
          "es": "¿Cuánto ganas al año?"
        },
        "kind": "number",
        "unit": {
          "en": "USD",
          "es": "USD"
        }
      },
      {
        "id": "household_size",
        "label": {
          "en": "How many people are in your household?",
          "es": "¿Cuántas personas viven en tu hogar?"
        },
        "kind": "number",
        "max": 50
      },
      {
        "id": "employer",
        "label": {
          "en": "What type of employer do you work for?",
          "es": "¿Para qué tipo de empleador trabajas?"
        },
        "kind": "select",
        "options": [
          {
            "value": "government",
            "label": {
              "en": "Government",
              "es": "Gobierno"
            }
          },
          {
            "value": "nonprofit",
            "label": {
              "en": "Nonprofit",
              "es": "Organización sin fines de lucro"
            }
          },
          {
            "value": "private",
            "label": {
              "en": "Private business",
              "es": "Empresa privada"
            }
          },
          {
            "value": "self",
            "label": {
              "en": "Self-employed",
              "es": "Por cuenta propia"
            }
          },
          {
            "value": "none",
            "label": {
              "en": "Not currently employed",
              "es": "Sin empleo actualmente"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "payments",
        "label": {
          "en": "How have your recent loan payments gone?",
          "es": "¿Cómo han sido tus pagos recientes?"
        },
        "kind": "select",
        "options": [
          {
            "value": "on_time",
            "label": {
              "en": "On time",
              "es": "A tiempo"
            }
          },
          {
            "value": "late",
            "label": {
              "en": "Some late payments",
              "es": "Algunos pagos atrasados"
            }
          },
          {
            "value": "missed",
            "label": {
              "en": "Missed payments",
              "es": "Pagos no realizados"
            }
          },
          {
            "value": "not_due",
            "label": {
              "en": "No payments due",
              "es": "Sin pagos vencidos"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "paused",
        "label": {
          "en": "Are payments currently paused?",
          "es": "¿Los pagos están pausados actualmente?"
        },
        "kind": "select",
        "options": [
          {
            "value": "yes",
            "label": {
              "en": "Yes",
              "es": "Sí"
            }
          },
          {
            "value": "no",
            "label": {
              "en": "No",
              "es": "No"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "actions",
        "label": {
          "en": "Which repayment or relief actions have you already tried?",
          "es": "¿Qué acciones de pago o alivio ya has intentado?"
        },
        "kind": "multi",
        "options": [
          {
            "value": "plan_review",
            "label": {
              "en": "Repayment-plan review",
              "es": "Revisión del plan"
            }
          },
          {
            "value": "consolidation",
            "label": {
              "en": "Consolidation",
              "es": "Consolidación"
            }
          },
          {
            "value": "relief",
            "label": {
              "en": "Relief-program review",
              "es": "Revisión de programas de alivio"
            }
          },
          {
            "value": "none",
            "label": {
              "en": "None",
              "es": "Ninguna"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "priority",
        "label": {
          "en": "What is your main student-loan goal?",
          "es": "¿Cuál es tu meta principal para tus préstamos?"
        },
        "kind": "select",
        "options": [
          {
            "value": "payment",
            "label": {
              "en": "Manage payments",
              "es": "Manejar los pagos"
            }
          },
          {
            "value": "payoff",
            "label": {
              "en": "Pay off debt",
              "es": "Liquidar la deuda"
            }
          },
          {
            "value": "options",
            "label": {
              "en": "Understand options",
              "es": "Entender las opciones"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "timing",
        "label": {
          "en": "When would you like to review your options?",
          "es": "¿Cuándo quisieras revisar tus opciones?"
        },
        "kind": "select",
        "options": [
          {
            "value": "soon",
            "label": {
              "en": "Within 3 months",
              "es": "En 3 meses"
            }
          },
          {
            "value": "year",
            "label": {
              "en": "Within a year",
              "es": "En un año"
            }
          },
          {
            "value": "later",
            "label": {
              "en": "Later / exploring",
              "es": "Más adelante / explorando"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      }
    ]
  },
  "home_buyer": {
    "title": {
      "en": "Home Buyer Readiness Review",
      "es": "Revisión para Comprar Vivienda"
    },
    "assessmentPath": "/home-buyer-assessment",
    "storageKey": "valtoris-home-buyer-answers",
    "questions": [
      {
        "id": "timing",
        "label": {
          "en": "When would you like to buy?",
          "es": "¿Cuándo quisieras comprar?"
        },
        "kind": "select",
        "options": [
          {
            "value": "soon",
            "label": {
              "en": "Within 3 months",
              "es": "En 3 meses"
            }
          },
          {
            "value": "year",
            "label": {
              "en": "Within a year",
              "es": "En un año"
            }
          },
          {
            "value": "later",
            "label": {
              "en": "Later / exploring",
              "es": "Más adelante / explorando"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "occupancy",
        "label": {
          "en": "Will this be your primary home, a second home, or an investment?",
          "es": "¿Será tu vivienda principal, segunda vivienda o inversión?"
        },
        "kind": "select",
        "options": [
          {
            "value": "primary",
            "label": {
              "en": "Primary home",
              "es": "Vivienda principal"
            }
          },
          {
            "value": "second",
            "label": {
              "en": "Second home",
              "es": "Segunda vivienda"
            }
          },
          {
            "value": "investment",
            "label": {
              "en": "Investment",
              "es": "Inversión"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "credit_range",
        "label": {
          "en": "What credit-score range do you believe you are in?",
          "es": "¿En qué rango crees que está tu puntaje de crédito?"
        },
        "kind": "select",
        "options": [
          {
            "value": "740_plus",
            "label": {
              "en": "740 or higher",
              "es": "740 o más"
            }
          },
          {
            "value": "700_739",
            "label": {
              "en": "700–739",
              "es": "700–739"
            }
          },
          {
            "value": "660_699",
            "label": {
              "en": "660–699",
              "es": "660–699"
            }
          },
          {
            "value": "620_659",
            "label": {
              "en": "620–659",
              "es": "620–659"
            }
          },
          {
            "value": "below_620",
            "label": {
              "en": "Below 620",
              "es": "Menos de 620"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "credit_issues",
        "label": {
          "en": "Which credit issues currently apply?",
          "es": "¿Qué problemas de crédito existen actualmente?"
        },
        "kind": "multi",
        "options": [
          {
            "value": "late",
            "label": {
              "en": "Late payments",
              "es": "Pagos atrasados"
            }
          },
          {
            "value": "collections",
            "label": {
              "en": "Collections",
              "es": "Cobranzas"
            }
          },
          {
            "value": "bankruptcy",
            "label": {
              "en": "Bankruptcy",
              "es": "Bancarrota"
            }
          },
          {
            "value": "errors",
            "label": {
              "en": "Possible errors / identity concerns",
              "es": "Posibles errores / problemas de identidad"
            }
          },
          {
            "value": "none",
            "label": {
              "en": "None known",
              "es": "Ninguno conocido"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "income",
        "label": {
          "en": "What is all applicants’ reliable monthly income before taxes?",
          "es": "¿Cuáles son los ingresos mensuales estables de todos los solicitantes, antes de impuestos?"
        },
        "kind": "number",
        "unit": {
          "en": "USD/month",
          "es": "USD/mes"
        }
      },
      {
        "id": "income_months",
        "label": {
          "en": "For how many months has that income been stable?",
          "es": "¿Por cuántos meses han sido estables esos ingresos?"
        },
        "kind": "number",
        "max": 600
      },
      {
        "id": "debt_payment",
        "label": {
          "en": "What are your total monthly non-housing debt payments?",
          "es": "¿Cuánto pagas al mes por deudas, sin incluir vivienda?"
        },
        "kind": "number",
        "unit": {
          "en": "USD/month",
          "es": "USD/mes"
        }
      },
      {
        "id": "budget",
        "label": {
          "en": "What monthly housing payment fits your budget comfortably?",
          "es": "¿Qué pago mensual de vivienda cabe cómodamente en tu presupuesto?"
        },
        "kind": "number",
        "unit": {
          "en": "USD/month",
          "es": "USD/mes"
        }
      },
      {
        "id": "purchase_funds",
        "label": {
          "en": "How much is available for the purchase after protecting reserves?",
          "es": "¿Cuánto tienes disponible para comprar después de separar tus reservas?"
        },
        "kind": "number",
        "unit": {
          "en": "USD",
          "es": "USD"
        }
      },
      {
        "id": "reserves",
        "label": {
          "en": "How many months of expenses would those reserves cover?",
          "es": "¿Cuántos meses de gastos cubrirían esas reservas?"
        },
        "kind": "number",
        "max": 120
      },
      {
        "id": "documents",
        "label": {
          "en": "Which core documents are ready?",
          "es": "¿Qué documentos principales están listos?"
        },
        "kind": "multi",
        "options": [
          {
            "value": "income",
            "label": {
              "en": "Income documents",
              "es": "Comprobantes de ingresos"
            }
          },
          {
            "value": "bank",
            "label": {
              "en": "Bank statements",
              "es": "Estados de cuenta"
            }
          },
          {
            "value": "tax",
            "label": {
              "en": "Tax returns",
              "es": "Declaraciones de impuestos"
            }
          },
          {
            "value": "id",
            "label": {
              "en": "Government ID",
              "es": "Identificación oficial"
            }
          },
          {
            "value": "none",
            "label": {
              "en": "None ready",
              "es": "Ninguno listo"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "lender",
        "label": {
          "en": "Have you discussed prequalification or preapproval with a lender?",
          "es": "¿Has hablado de precalificación o preaprobación con un prestamista?"
        },
        "kind": "select",
        "options": [
          {
            "value": "yes",
            "label": {
              "en": "Yes",
              "es": "Sí"
            }
          },
          {
            "value": "no",
            "label": {
              "en": "No",
              "es": "No"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      }
    ]
  },
  "retirement": {
    "title": {
      "en": "Retirement Readiness Review",
      "es": "Revisión de Jubilación"
    },
    "assessmentPath": "/retirement-assessment",
    "storageKey": "valtoris-retirement-answers",
    "questions": [
      {
        "id": "retired",
        "label": {
          "en": "Are you already retired?",
          "es": "¿Ya estás jubilado/a?"
        },
        "kind": "select",
        "options": [
          {
            "value": "yes",
            "label": {
              "en": "Yes",
              "es": "Sí"
            }
          },
          {
            "value": "no",
            "label": {
              "en": "No",
              "es": "No"
            }
          }
        ]
      },
      {
        "id": "age",
        "label": {
          "en": "How old are you?",
          "es": "¿Cuántos años tienes?"
        },
        "kind": "number",
        "max": 110
      },
      {
        "id": "target_age",
        "label": {
          "en": "At what age would you like to retire?",
          "es": "¿A qué edad quisieras jubilarte?"
        },
        "kind": "number",
        "max": 110,
        "when": {
          "field": "retired",
          "not": "yes"
        }
      },
      {
        "id": "savings",
        "label": {
          "en": "About how much have you saved for retirement?",
          "es": "¿Cuánto has ahorrado para la jubilación?"
        },
        "kind": "number",
        "unit": {
          "en": "USD",
          "es": "USD"
        }
      },
      {
        "id": "contribution",
        "label": {
          "en": "How much do you add to retirement savings each month?",
          "es": "¿Cuánto aportas al mes para la jubilación?"
        },
        "kind": "number",
        "unit": {
          "en": "USD/month",
          "es": "USD/mes"
        }
      },
      {
        "id": "spending",
        "label": {
          "en": "How much would you expect to spend monthly in retirement, in today’s dollars?",
          "es": "¿Cuánto esperas gastar al mes durante la jubilación, en dólares de hoy?"
        },
        "kind": "number",
        "unit": {
          "en": "USD/month",
          "es": "USD/mes"
        }
      },
      {
        "id": "income",
        "label": {
          "en": "How much dependable monthly retirement income do you expect, in today’s dollars?",
          "es": "¿Cuántos ingresos mensuales confiables esperas durante la jubilación, en dólares de hoy?"
        },
        "kind": "number",
        "unit": {
          "en": "USD/month",
          "es": "USD/mes"
        }
      },
      {
        "id": "risk",
        "label": {
          "en": "How comfortable are you with investment values changing?",
          "es": "¿Qué tan cómodo/a estás con los cambios de valor de tus inversiones?"
        },
        "kind": "select",
        "options": [
          {
            "value": "low",
            "label": {
              "en": "Prefer stability",
              "es": "Prefiero estabilidad"
            }
          },
          {
            "value": "moderate",
            "label": {
              "en": "Some changes are acceptable",
              "es": "Acepto algunos cambios"
            }
          },
          {
            "value": "high",
            "label": {
              "en": "Comfortable with large changes",
              "es": "Acepto cambios grandes"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "accounts",
        "label": {
          "en": "Which types of retirement accounts do you use?",
          "es": "¿Qué tipos de cuentas de jubilación usas?"
        },
        "kind": "multi",
        "options": [
          {
            "value": "traditional",
            "label": {
              "en": "Traditional 401(k) / IRA",
              "es": "401(k) / IRA tradicional"
            }
          },
          {
            "value": "roth",
            "label": {
              "en": "Roth",
              "es": "Roth"
            }
          },
          {
            "value": "taxable",
            "label": {
              "en": "Taxable investments",
              "es": "Inversiones gravables"
            }
          },
          {
            "value": "other",
            "label": {
              "en": "Other",
              "es": "Otras"
            }
          },
          {
            "value": "none",
            "label": {
              "en": "None",
              "es": "Ninguna"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "healthcare",
        "label": {
          "en": "How prepared is your healthcare-funding plan?",
          "es": "¿Qué tan preparado está tu plan para pagar la atención médica?"
        },
        "kind": "select",
        "options": [
          {
            "value": "ready",
            "label": {
              "en": "Reviewed plan in place",
              "es": "Plan revisado establecido"
            }
          },
          {
            "value": "partial",
            "label": {
              "en": "Partly prepared",
              "es": "Parcialmente preparado"
            }
          },
          {
            "value": "none",
            "label": {
              "en": "No plan yet",
              "es": "Sin plan todavía"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "documents",
        "label": {
          "en": "Which key estate documents are current?",
          "es": "¿Qué documentos patrimoniales principales están actualizados?"
        },
        "kind": "multi",
        "options": [
          {
            "value": "will",
            "label": {
              "en": "Will",
              "es": "Testamento"
            }
          },
          {
            "value": "trust",
            "label": {
              "en": "Trust",
              "es": "Fideicomiso"
            }
          },
          {
            "value": "beneficiaries",
            "label": {
              "en": "Beneficiaries reviewed",
              "es": "Beneficiarios revisados"
            }
          },
          {
            "value": "guardian",
            "label": {
              "en": "Guardian plan, if applicable",
              "es": "Plan de tutor, si corresponde"
            }
          },
          {
            "value": "poa",
            "label": {
              "en": "Power of attorney",
              "es": "Poder legal"
            }
          },
          {
            "value": "none",
            "label": {
              "en": "None current",
              "es": "Ninguno actualizado"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "priority",
        "label": {
          "en": "What is your main retirement concern?",
          "es": "¿Cuál es tu principal preocupación para la jubilación?"
        },
        "kind": "select",
        "options": [
          {
            "value": "income",
            "label": {
              "en": "Income",
              "es": "Ingresos"
            }
          },
          {
            "value": "savings",
            "label": {
              "en": "Savings",
              "es": "Ahorros"
            }
          },
          {
            "value": "health",
            "label": {
              "en": "Healthcare",
              "es": "Atención médica"
            }
          },
          {
            "value": "tax",
            "label": {
              "en": "Taxes",
              "es": "Impuestos"
            }
          },
          {
            "value": "legacy",
            "label": {
              "en": "Legacy",
              "es": "Legado"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      }
    ]
  },
  "credit": {
    "title": {
      "en": "Credit Readiness Review",
      "es": "Revisión de Crédito"
    },
    "assessmentPath": "/credit-assessment",
    "storageKey": "valtoris-credit-answers",
    "questions": [
      {
        "id": "priority",
        "label": {
          "en": "What is your main credit goal?",
          "es": "¿Cuál es tu principal meta de crédito?"
        },
        "kind": "select",
        "options": [
          {
            "value": "home",
            "label": {
              "en": "Buy a home",
              "es": "Comprar vivienda"
            }
          },
          {
            "value": "debt",
            "label": {
              "en": "Manage debt",
              "es": "Manejar deudas"
            }
          },
          {
            "value": "errors",
            "label": {
              "en": "Review possible errors",
              "es": "Revisar posibles errores"
            }
          },
          {
            "value": "health",
            "label": {
              "en": "Understand credit health",
              "es": "Entender mi crédito"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "credit_range",
        "label": {
          "en": "What credit-score range do you believe you are in?",
          "es": "¿En qué rango crees que está tu puntaje de crédito?"
        },
        "kind": "select",
        "options": [
          {
            "value": "740_plus",
            "label": {
              "en": "740 or higher",
              "es": "740 o más"
            }
          },
          {
            "value": "700_739",
            "label": {
              "en": "700–739",
              "es": "700–739"
            }
          },
          {
            "value": "660_699",
            "label": {
              "en": "660–699",
              "es": "660–699"
            }
          },
          {
            "value": "620_659",
            "label": {
              "en": "620–659",
              "es": "620–659"
            }
          },
          {
            "value": "below_620",
            "label": {
              "en": "Below 620",
              "es": "Menos de 620"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "review",
        "label": {
          "en": "When did you last review your credit reports?",
          "es": "¿Cuándo revisaste tus reportes de crédito por última vez?"
        },
        "kind": "select",
        "options": [
          {
            "value": "recent",
            "label": {
              "en": "Within 3 months",
              "es": "En los últimos 3 meses"
            }
          },
          {
            "value": "year",
            "label": {
              "en": "Within a year",
              "es": "En el último año"
            }
          },
          {
            "value": "older",
            "label": {
              "en": "More than a year ago",
              "es": "Hace más de un año"
            }
          },
          {
            "value": "never",
            "label": {
              "en": "Never",
              "es": "Nunca"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "errors",
        "label": {
          "en": "Do you believe anything may be inaccurate or not yours?",
          "es": "¿Crees que hay información incorrecta o que no te pertenece?"
        },
        "kind": "select",
        "options": [
          {
            "value": "yes",
            "label": {
              "en": "Yes",
              "es": "Sí"
            }
          },
          {
            "value": "no",
            "label": {
              "en": "No",
              "es": "No"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "delay",
        "label": {
          "en": "What is the most serious payment delay you have had in the last 12 months?",
          "es": "¿Cuál fue tu mayor atraso de pago en los últimos 12 meses?"
        },
        "kind": "select",
        "options": [
          {
            "value": "none",
            "label": {
              "en": "None",
              "es": "Ninguno"
            }
          },
          {
            "value": "under_30",
            "label": {
              "en": "Under 30 days",
              "es": "Menos de 30 días"
            }
          },
          {
            "value": "30_59",
            "label": {
              "en": "30–59 days",
              "es": "30–59 días"
            }
          },
          {
            "value": "60_plus",
            "label": {
              "en": "60 days or more",
              "es": "60 días o más"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "negative_items",
        "label": {
          "en": "Which negative items do you believe are present?",
          "es": "¿Qué elementos negativos crees que aparecen?"
        },
        "kind": "multi",
        "options": [
          {
            "value": "late",
            "label": {
              "en": "Late payments",
              "es": "Pagos atrasados"
            }
          },
          {
            "value": "collections",
            "label": {
              "en": "Collections",
              "es": "Cobranzas"
            }
          },
          {
            "value": "bankruptcy",
            "label": {
              "en": "Bankruptcy",
              "es": "Bancarrota"
            }
          },
          {
            "value": "errors",
            "label": {
              "en": "Possible errors / identity concerns",
              "es": "Posibles errores / problemas de identidad"
            }
          },
          {
            "value": "none",
            "label": {
              "en": "None known",
              "es": "Ninguno conocido"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "utilization",
        "label": {
          "en": "What percentage of your available card credit are you using?",
          "es": "¿Qué porcentaje de tu crédito disponible en tarjetas estás usando?"
        },
        "kind": "number",
        "unit": {
          "en": "% used (e.g. $300 of $1,000 = 30%)",
          "es": "% usado (ej. $300 de $1,000 = 30%)"
        },
        "max": 500
      },
      {
        "id": "oldest_years",
        "label": {
          "en": "About how old is your oldest open account, in years?",
          "es": "¿Cuántos años tiene tu cuenta abierta más antigua?"
        },
        "kind": "number",
        "max": 100
      },
      {
        "id": "inquiries",
        "label": {
          "en": "How many credit applications have you made in the last 6 months?",
          "es": "¿Cuántas solicitudes de crédito hiciste en los últimos 6 meses?"
        },
        "kind": "number",
        "max": 100
      },
      {
        "id": "minimums",
        "label": {
          "en": "How manageable are your minimum monthly payments?",
          "es": "¿Qué tan manejables son tus pagos mínimos mensuales?"
        },
        "kind": "select",
        "options": [
          {
            "value": "comfortable",
            "label": {
              "en": "Comfortable",
              "es": "Cómodos"
            }
          },
          {
            "value": "tight",
            "label": {
              "en": "Tight",
              "es": "Ajustados"
            }
          },
          {
            "value": "unmanageable",
            "label": {
              "en": "Cannot keep up",
              "es": "No puedo cumplirlos"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "overdue",
        "label": {
          "en": "Are any accounts currently overdue?",
          "es": "¿Tienes alguna cuenta vencida actualmente?"
        },
        "kind": "select",
        "options": [
          {
            "value": "yes",
            "label": {
              "en": "Yes",
              "es": "Sí"
            }
          },
          {
            "value": "no",
            "label": {
              "en": "No",
              "es": "No"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      },
      {
        "id": "timing",
        "label": {
          "en": "When would you like a review?",
          "es": "¿Cuándo quisieras una revisión?"
        },
        "kind": "select",
        "options": [
          {
            "value": "soon",
            "label": {
              "en": "Within 3 months",
              "es": "En 3 meses"
            }
          },
          {
            "value": "year",
            "label": {
              "en": "Within a year",
              "es": "En un año"
            }
          },
          {
            "value": "later",
            "label": {
              "en": "Later / exploring",
              "es": "Más adelante / explorando"
            }
          },
          {
            "value": "unknown",
            "label": {
              "en": "Not sure",
              "es": "No sé"
            }
          }
        ]
      }
    ]
  }
}
