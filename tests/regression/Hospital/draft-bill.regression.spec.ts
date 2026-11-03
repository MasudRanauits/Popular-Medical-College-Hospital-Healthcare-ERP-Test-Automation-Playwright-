import { test } from '../../../fixtures';
import { hospitalItem } from '../../../pages';
import { admissionLookup, cases, opensFromDrawer } from './_case-packs';

/**
 * DRAFT BILL @regression
 *
 * The bill as it stands while the patient is still in a bed, with the eighteen documents
 * it can be printed as - rough summary, medicine copy, doctor copy, office copy.
 *
 * None of them is printed here. Each is a server-rendered document per patient.
 *
 * Driven by the module's admission lookup. Read-only: nothing here submits.
 */

const ITEM = hospitalItem('DRAFT BILL');

test.describe('DRAFT BILL @regression', () => {
  cases(ITEM, opensFromDrawer(), admissionLookup('Print Sticker')).forEach(({ title, run }) => test(title, run));
});
