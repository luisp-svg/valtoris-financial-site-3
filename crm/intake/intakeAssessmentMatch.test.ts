import { describe, expect, it } from 'vitest'
import { DIGITAL_IDENTITY_LEAD_TYPE } from '../../modules/digital-identity'
import {
  INTAKE_MISSING_ASSESSMENT_COPY,
  intakeAssessmentDetailKind,
  intakeAssessmentDetailRenderer,
  selectIntakeLinkedAssessment,
} from './intakeAssessmentMatch'

function assessment(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'assess-1',
    lead_id: 'lead-1',
    household_id: 'hh-1',
    assessment_type: 'family',
    status: 'completed',
    capture_channel: 'public_self_report',
    completed_at: '2026-08-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  }
}

describe('selectIntakeLinkedAssessment', () => {
  it('prefers the assessment linked by lead_id of the matching type', () => {
    const rows = [
      assessment({
        id: 'assess-later-family',
        lead_id: 'lead-other',
        assessment_type: 'family',
        completed_at: '2026-08-22T00:00:00.000Z',
      }),
      assessment({
        id: 'assess-sl',
        lead_id: 'lead-sl',
        assessment_type: 'student_loan',
        completed_at: '2026-08-01T00:00:00.000Z',
      }),
    ]
    expect(
      selectIntakeLinkedAssessment({
        leadId: 'lead-sl',
        householdId: 'hh-1',
        leadType: 'Student Loan Report Card',
        assessments: rows,
      })?.id,
    ).toBe('assess-sl')
  })

  it('does not select a later household assessment of a different lead', () => {
    const selected = selectIntakeLinkedAssessment({
      leadId: 'lead-sl',
      householdId: 'hh-1',
      leadType: 'Student Loan Report Card',
      assessments: [
        assessment({
          id: 'assess-family-latest',
          lead_id: 'lead-other',
          household_id: 'hh-1',
          assessment_type: 'family',
          completed_at: '2026-08-22T00:00:00.000Z',
        }),
      ],
    })
    expect(selected).toBeNull()
  })

  it('rejects a same-lead row of the wrong assessment_type', () => {
    expect(
      selectIntakeLinkedAssessment({
        leadId: 'lead-sl',
        householdId: 'hh-1',
        leadType: 'Student Loan Report Card',
        assessments: [assessment({ lead_id: 'lead-sl', assessment_type: 'family' })],
      }),
    ).toBeNull()
  })

  it('rejects a same-lead row attached to a different household', () => {
    expect(
      selectIntakeLinkedAssessment({
        leadId: 'lead-1',
        householdId: 'hh-1',
        leadType: 'Family Report Card',
        assessments: [assessment({ household_id: 'hh-other' })],
      }),
    ).toBeNull()
  })

  it('does not invent an assessment for Digital Identity', () => {
    expect(
      selectIntakeLinkedAssessment({
        leadId: 'lead-di',
        householdId: 'hh-1',
        leadType: DIGITAL_IDENTITY_LEAD_TYPE,
        assessments: [assessment({ lead_id: 'lead-di' })],
      }),
    ).toBeNull()
  })
})

describe('intakeAssessmentDetailKind dispatch', () => {
  const types = [
    ['Family Report Card', 'family'],
    ['Business Report Card', 'business'],
    ['Retirement Report Card', 'retirement'],
    ['Protection Gap', 'protection'],
    ['Student Loan Report Card', 'student_loan'],
    ['Credit Report Card', 'credit'],
    ['Home Buyer Report Card', 'home_buyer'],
  ] as const

  it.each(types)('maps %s to %s detail', (leadType, assessmentType) => {
    const kind = intakeAssessmentDetailKind({
      leadType,
      diagnostic: {
        assessmentId: 'assess-1',
        overallScore: 70,
        overallGrade: 'C',
        categories: [],
        topPriorities: [],
        captureChannel: 'public_self_report',
        scoringVersion: 1,
        completedAt: '2026-08-01T00:00:00.000Z',
        productLabel: 'Initial Financial Diagnostic',
        assessmentType,
        protectionGapFormatted: null,
        netProtectionGap: null,
        totalNeed: null,
        currentProtection: null,
      },
      digitalIdentity: null,
      assessmentDetail: {
        assessmentId: 'assess-1',
        householdId: 'hh-1',
        productLabel: 'label',
        assessmentType,
        overallScore: 70,
        overallGrade: 'C',
        protectionGapFormatted: null,
        completedAt: '2026-08-01T00:00:00.000Z',
        scoringVersion: 1,
        currentLevel: null,
        categories: [],
        priorities: [],
        flags: [],
        submittedSnapshot: {
          firstName: null,
          lastName: null,
          email: null,
          phone: null,
          age: null,
          state: null,
          maritalStatus: null,
          numberOfChildren: null,
          householdIncome: null,
          monthlyHousingPayment: null,
          totalDebt: null,
          emergencyFundMonths: null,
          monthlyCashFlow: null,
          retirementContribution: null,
          currentLifeInsurance: null,
          hasDisabilityProtection: null,
          hasWill: null,
          hasTrust: null,
          beneficiariesReviewed: null,
          guardianDocumented: null,
          submittedGoals: [],
        },
        submittedAnswers: [],
        consent: null,
        lead: null,
      },
    })
    expect(kind).toBe(assessmentType)
    expect(intakeAssessmentDetailRenderer(kind)).toBe('PublicFamilyDiagnosticDetailView')
  })

  it('maps Digital Identity to lead-only detail', () => {
    const kind = intakeAssessmentDetailKind({
      leadType: DIGITAL_IDENTITY_LEAD_TYPE,
      diagnostic: null,
      digitalIdentity: {
        company: 'Acme',
        title: null,
        reason: 'Networking',
        note: null,
        preferredFollowUp: 'email',
        cardPublicKey: null,
        cardSlug: null,
        advisorSlug: 'jane',
        campaignCode: null,
        eventCode: null,
        relationshipPhoto: null,
        productLabel: 'Digital Identity',
      },
      assessmentDetail: null,
    })
    expect(kind).toBe('digital_identity')
    expect(intakeAssessmentDetailRenderer(kind)).toBe('lead_only')
  })

  it('maps a missing linked assessment to the safe empty state', () => {
    const kind = intakeAssessmentDetailKind({
      leadType: 'Student Loan Report Card',
      diagnostic: null,
      digitalIdentity: null,
      assessmentDetail: null,
    })
    expect(kind).toBe('missing')
    expect(intakeAssessmentDetailRenderer(kind)).toBe('empty')
    expect(INTAKE_MISSING_ASSESSMENT_COPY).toBe(
      'Assessment details are not available for this Intake.',
    )
  })
})
