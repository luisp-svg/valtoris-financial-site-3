import { describe, expect, it } from 'vitest';
import {
  COMBINED_FORMAT, MAX_ASSESSMENT_QUESTIONS, PRIORITIES, combinedAnswerRows, combinedQuestions,
  readStoredCombined, updateCombined, validateCombined, type CombinedAnswers,
} from './engine';
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

  it('preserves earlier readiness-only submissions and the overall question cap', () => {
    const selected = PRIORITIES.map(priority => priority.id);
    expect(combinedQuestions(selected, answers.diagnostic, 1, 1, 1)).toHaveLength(MAX_ASSESSMENT_QUESTIONS);
    const oldDiagnostic = Object.fromEntries(combinedQuestions(answers.selected, {}, 1, 1).map(q => [q.id, 'unknown']));
    const old = validateCombined({ ...answers, cardVersion: undefined, diagnostic: oldDiagnostic })!;
    expect(combinedResults(old).map(review => review.kind)).toEqual(['adaptive', 'adaptive']);
  });
});
