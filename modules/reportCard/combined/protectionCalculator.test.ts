import { describe, expect, it } from 'vitest';
import {
  COMBINED_FORMAT, MAX_ASSESSMENT_QUESTIONS, PRIORITIES, combinedAnswerRows, combinedQuestions,
  readStoredCombined, updateCombined, validateCombined, type CombinedAnswers,
} from './engine';
import { familyAreas, businessAreas } from './cardProfiles';
import { adaptiveReportCard, combinedResults } from './results';

const answers: CombinedAnswers = {
  format: COMBINED_FORMAT,
  strategyVersion: 1,
  cardVersion: 1,
  selected: ['family', 'protection'],
  locale: 'en',
  diagnostic: {
    'shared.state': 'CA',
    'family.housing': 'own',
    'family.mortgage_balance': '200000',
    'family.annual_support': '30000',
    'family.support_years': '10',
    'family.other_needs': '25000',
    'family.life_coverage': '100000',
    'protection.monthly_expenses': '4800',
    'protection.continuing_income': '1500',
    'protection.monthly_benefit': '2000',
  },
  contact: { fullName: 'Synthetic Visitor', email: 'visitor@example.invalid', phone: '+12025550100' },
};

describe('combined protection calculator', () => {
  it('uses the remaining mortgage balance and keeps monthly disability separate on the same saved assessment', () => {
    expect(validateCombined(answers)).toEqual(answers);
    const { contact: _contact, ...stored } = answers;
    const restored = readStoredCombined(stored)!;
    expect(combinedResults(restored)).toMatchObject([
      { type: 'family', kind: 'protection-estimate', result: { amount: 425000 } },
      { type: 'protection', kind: 'protection-estimate', result: { amount: 1300 } },
    ]);
    expect(combinedAnswerRows(stored)).toContainEqual(expect.objectContaining({ id: 'family.mortgage_balance', value: '200000' }));
    expect(adaptiveReportCard({ ...restored, format: COMBINED_FORMAT })).toBeNull();
  });

  it('prunes the mortgage balance when housing changes and uses exactly 60 months of rent', () => {
    const rentAnswers = updateCombined(answers.selected, answers.diagnostic, 'family.housing', 'rent', 1, 1, 1);
    expect(rentAnswers['family.mortgage_balance']).toBeUndefined();
    expect(validateCombined({ ...answers, diagnostic: rentAnswers })).toBeNull();
    rentAnswers['family.monthly_rent'] = '1800';
    const saved = validateCombined({ ...answers, diagnostic: rentAnswers })!;
    expect(combinedResults(saved)[0]).toMatchObject({
      result: { amount: 333000, rows: expect.arrayContaining([{ label: 'Five years of rent', amount: 108000 }]) },
    });
  });

  it('keeps an unknown benefit distinct from confirmed zero coverage', () => {
    const diagnostic = { ...answers.diagnostic, 'protection.monthly_benefit': 'unknown', 'family.mortgage_balance': '0' };
    const saved = validateCombined({ ...answers, diagnostic })!;
    expect(combinedResults(saved)).toMatchObject([
      { result: { amount: 225000 } },
      { result: { amount: null, missing: [expect.stringContaining('disability coverage')] } },
    ]);
    diagnostic['protection.monthly_benefit'] = '0';
    expect(combinedResults(saved)[1]).toMatchObject({ result: { amount: 3300 } });
  });

  it.each([['own', 200000], ['rent', 108000]] as const)(
    'uses DIME in the Family Report Card with %s housing and no separate disability questionnaire',
    (housing, housingTotal) => {
      const diagnostic: CombinedAnswers['diagnostic'] = {
        'family.housing': housing,
        [housing === 'own' ? 'family.mortgage_balance' : 'family.monthly_rent']: housing === 'own' ? '200000' : '1800',
        'family.dime_debt': '20000',
        'family.annual_support': '50000',
        'family.support_years': '15',
        'family.dime_education': '40000',
        'family.life_coverage': '100000',
      };
      const questions = combinedQuestions(familyAreas, diagnostic, 1, 1, 1);
      const ids = questions.map(question => question.id);
      expect(ids).toHaveLength(19);
      expect(ids.slice(ids.indexOf('family.reserves.review') + 1, ids.indexOf('family.dime_debt')))
        .toEqual(['credit.status', 'credit.review']);
      expect(ids).not.toContain('credit.goal');
      expect(ids).not.toContain('protection.monthly_expenses');
      expect(ids.slice(ids.indexOf('family.dime_debt'), ids.indexOf('family.life_coverage') + 1)).toEqual([
        'family.dime_debt', 'family.annual_support', 'family.support_years', 'family.housing',
        housing === 'own' ? 'family.mortgage_balance' : 'family.monthly_rent', 'family.dime_education', 'family.life_coverage',
      ]);
      expect(questions.find(question => question.id === 'family.support_years')?.question.options?.map(option => option.value))
        .toEqual(['10', '15', '20', '30', 'unknown']);
      for (const { id, question } of questions) {
        diagnostic[id] ??= question.kind === 'multi' ? ['unknown'] : 'unknown';
      }
      const saved = validateCombined({ ...answers, insuranceRoutingVersion: 1, selected: familyAreas, diagnostic })!;
      expect(saved).not.toBeNull();
      const estimates = combinedResults(saved).filter(review => review.kind === 'protection-estimate');
      expect(estimates).toHaveLength(1);
      expect(estimates[0].result.amount).toBe(20_000 + 50_000 * 15 + housingTotal + 40_000 - 100_000);
      const unknown = combinedResults({ ...saved, diagnostic: { ...diagnostic, 'family.life_coverage': 'unknown' } })
        .find(review => review.kind === 'protection-estimate');
      expect(unknown?.result.amount).toBeNull();
    },
  );

  it('keeps Business Owner topics contiguous and skips employee benefits for owners without employees', () => {
    const withEmployees = combinedQuestions(businessAreas, { 'benefits.workforce': 'small' }, 1, 1, 1);
    const withoutEmployees = combinedQuestions(businessAreas, { 'benefits.workforce': 'none' }, 1, 1, 1);
    expect(withEmployees).toHaveLength(17);
    expect(withoutEmployees).toHaveLength(15);
    expect(withoutEmployees.filter(question => question.reviews[0] === 'benefits').map(question => question.id))
      .toEqual(['benefits.workforce']);
    const ids = withEmployees.map(question => question.id);
    expect(ids.indexOf('benefits.status')).toBe(ids.indexOf('benefits.workforce') + 1);
    expect(ids).not.toContain('commercial.people');
    expect(ids).not.toContain('business.review');
  });

  it('preserves earlier readiness-only submissions and the overall question cap', () => {
    const selected = PRIORITIES.map(priority => priority.id);
    expect(combinedQuestions(selected, answers.diagnostic, 1, 1, 1)).toHaveLength(MAX_ASSESSMENT_QUESTIONS);
    const oldDiagnostic = Object.fromEntries(combinedQuestions(answers.selected, {}, 1, 1).map(q => [q.id, 'unknown']));
    const old = validateCombined({ ...answers, cardVersion: undefined, diagnostic: oldDiagnostic })!;
    expect(combinedResults(old).map(review => review.kind)).toEqual(['adaptive', 'adaptive']);
  });
});
