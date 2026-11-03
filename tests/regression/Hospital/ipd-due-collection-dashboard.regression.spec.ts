import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, dateDashboard, opensFromDrawer } from './_case-packs';

/**
 * IPD Due Collection Dashboard @regression
 *
 * What was collected against outstanding inpatient bills, over a date range. Labels its
 * range "From Date" and "To Date" where the others say "Start Date" and "End Date".
 *
 * A date-range report. Nothing here writes; the suite sets a range and reads what comes
 * back.
 */

const ITEM = hospitalItem('IPD Due Collection Dashboard');

test.describe('IPD Due Collection Dashboard @regression', () => {
  cases(ITEM, opensFromDrawer(), dateDashboard()).forEach(({ title, run }) => test(title, run));
});
