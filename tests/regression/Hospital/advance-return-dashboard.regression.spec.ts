import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, dateDashboard, opensFromDrawer } from './_case-packs';

/**
 * Advance Return Dashboard @regression
 *
 * Advance payments given back, over a date range. The mirror of Advance Dashboard.
 *
 * A date-range report. Nothing here writes; the suite sets a range and reads what comes
 * back.
 */

const ITEM = hospitalItem('Advance Return Dashboard');

test.describe('Advance Return Dashboard @regression', () => {
  cases(ITEM, opensFromDrawer(), dateDashboard()).forEach(({ title, run }) => test(title, run));
});
