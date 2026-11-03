import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, dateDashboard, opensFromDrawer } from './_case-packs';

/**
 * Billing Dashboard(Office) @regression
 *
 * The office copy of the discharged list. It is also where the discharged-bill suites go
 * to find a real discharged invoice to work with, since the correction screens have no
 * picker of their own.
 *
 * A date-range report. Nothing here writes; the suite sets a range and reads what comes
 * back.
 */

const ITEM = hospitalItem('Billing Dashboard(Office)');

test.describe('Billing Dashboard(Office) @regression', () => {
  cases(ITEM, opensFromDrawer(), dateDashboard()).forEach(({ title, run }) => test(title, run));
});
