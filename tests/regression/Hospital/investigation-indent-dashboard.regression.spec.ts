import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, dateDashboard, opensFromDrawer } from './_case-packs';

/**
 * Investigation Indent Dashboard @regression
 *
 * Investigation orders raised from the wards, over a date range, with their priority and
 * who they were for.
 *
 * A date-range report. Nothing here writes; the suite sets a range and reads what comes
 * back.
 */

const ITEM = hospitalItem('Investigation Indent Dashboard');

test.describe('Investigation Indent Dashboard @regression', () => {
  cases(ITEM, opensFromDrawer(), dateDashboard()).forEach(({ title, run }) => test(title, run));
});
