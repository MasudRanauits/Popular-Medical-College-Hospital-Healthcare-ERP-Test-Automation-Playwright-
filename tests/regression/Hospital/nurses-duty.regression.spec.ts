import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { cases, listScreen, opensFromDrawer } from './_case-packs';

/**
 * Nurses Duty @regression
 *
 * Which nurse is on which floor, and which indent outlet and departments they can work
 * against. It is what decides where a nurse’s indents go.
 *
 * A report: read-only, and its columns are its contract.
 */

const ITEM = hospitalItem('Nurses Duty');

test.describe('Nurses Duty @regression', () => {
  cases(
    ITEM,
    opensFromDrawer(),
    listScreen([
      'TENANT GUIDNAME', 'USER NAME', 'FULL NAME', 'DUTY FLOOR', 'INDENT OUTLET', 'DUTY DEPTS'
    ])
  ).forEach(({ title, run }) => test(title, run));
});
