import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, dateDashboard, opensFromDrawer } from './_case-packs';

/**
 * Billing Dashboard(Counter) @regression
 *
 * Discharged patients for the counter to settle.
 *
 * The one screen in the module built on MudBlazor date pickers rather than flatpickr, so
 * its dates read as M/D/YYYY where every other report reads YYYY-MM-DD. Its grid is a
 * MudBlazor table too. Both are handled in HospitalDateDashboardPage.
 *
 * A date-range report. Nothing here writes; the suite sets a range and reads what comes
 * back.
 */

const ITEM = hospitalItem('Billing Dashboard(Counter)');

test.describe('Billing Dashboard(Counter) @regression', () => {
  cases(ITEM, opensFromDrawer(), dateDashboard()).forEach(({ title, run }) => test(title, run));
});
