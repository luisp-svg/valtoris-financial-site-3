# Version 2.0 source reconciliation

The November 3 release of main a7de41e replaced a separately published Version 2.0 website. Restore the published source to GitHub so the next release retains the premium design, audience pages and current operational features.

## Provenance

- Restored production: dpl_Bh1qGC31UeBhHigKiHSPWC9JUGua (November 2, 2026).
- Original release commit: f8cf6c1e7b9899ae7139dbb606f46efe736d6c54, recovered from the original local release folder with a clean working tree and a release record naming that deployment.
- All 742 source files available in the current deployment connector listing match that release folder by SHA-1. The listing is truncated, so this is not a complete deployment-source certification.
- The original release record and live browser bundle both identify index-BjMgE8GW.js. The restored public homepage was also checked in the owner browser.
- This replaces the earlier reconstruction from the October 23 archive. Do not use that earlier candidate for a production release.

## Result

Recover the full published website and operational source, including the premium homepage, audience routes, combined assessment and verified-results flow, Amaze page, SMS pages, booking agent selection, digital-card capture updates, document authorization fixes, household pagination and multi-agent licensing. Preserve files already in main, including its November 3 Clearview quote catalog. Refresh the synthetic commercial quote fixture for those required fields.

Keep the stronger main-branch secret-file ignore rules. Correct obsolete test expectations for the published booking destination and Amaze navigation, plus a test regular-expression lint error. No product claims or license statements are changed.

The restored SQL migrations and draft files are existing published-source artifacts. Including them here does not authorize running them. Compare actual environment migration inventories before any later database operation; no migration or database change is part of this reconciliation.

## Release boundary

Automatic deployments are disabled only for codex/restore-valtoris-v2 and codex/academy-migration-audit. This review branch must remain separate from the Academy draft. The restored November 2 production deployment stays live during review.

Do not merge or promote until the combined source is reviewed and an explicit release is approved. Before that release, verify the exact commit, team/project and environment, stage and verify the combined build, then recheck the homepage, audience routes, commercial quotes, booking and authorized CRM access. Tests do not certify real provider bookings or live client data changes.

## Verification of this reconciliation

- Node 22.23.4: 453 test files passed, 34 skipped; 3,906 tests passed, 306 skipped.
- Type checking, lint and production build passed. The existing large-bundle warning remains.
- The API-function budget check passed: 12 API files and no API test bundles.
- Twenty isolated browser checks passed at 1440px and 390px across home, three audience pages, solutions, assessment, scheduling, Amaze Health, commercial quote and Spanish home. No horizontal overflow or broken local images was observed.
- These checks used no production credentials, submitted no live forms and made no real appointments. Real provider delivery and authenticated production CRM workflows still need release verification.
