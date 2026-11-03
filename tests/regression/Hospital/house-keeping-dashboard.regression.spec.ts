import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, listScreen, opensFromDrawer } from './_case-packs';

/**
 * House Keeping Dashboard @regression
 *
 * The beds house keeping has been handed, between one patient leaving and the next
 * arriving.
 *
 * A report: read-only, and its columns are its contract.
 */

const ITEM = hospitalItem('House Keeping Dashboard');

test.describe('House Keeping Dashboard @regression', () => {
  cases(
    ITEM,
    opensFromDrawer(),
    listScreen(['ID', 'CABINNO', 'DESCRIPTION', 'RENT', 'CABINTYPES', 'FLOOR', 'HDEPARTMENT'])
  ).forEach(({ title, run }) => test(title, run));
});
