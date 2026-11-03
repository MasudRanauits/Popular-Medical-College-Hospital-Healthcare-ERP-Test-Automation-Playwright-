import { test, expect } from '../../../fixtures';
import { DischargedEditPage, hospitalItem } from '../../../pages';
import { caseId, cases, dischargedEdit, opensFromDrawer, recentDischargedInvoice } from './_case-packs';

/**
 * EDIT DISCHARGED IPD SERVICES @regression
 *
 * Goes back into a discharged patient's bill and takes a ward service off it, or changes
 * what it cost.
 *
 * The highest-consequence screen in the module: everything else bills a patient who is
 * still in a bed and can be queried at the desk, and this changes what somebody was
 * charged after they were invoiced, paid and sent home. Nothing here types into a discount
 * box and nothing presses Save.
 *
 * It is also the screen the family's behaviour is worked on, since all five discharged
 * editors load a bill the same way. Finding a patient to work with is its own problem -
 * there is no picker, so the suite reads a real discharged invoice off Billing Dashboard
 * (Office) at run time. If that comes back empty, the cases that need a patient skip and
 * say so: a quiet month is not a defect.
 *
 * What comes back is not a grid. The services render as form rows - a heading per section,
 * a line per service, each with its own editable Discount box - and there is no `<table>`
 * anywhere on the loaded screen. `lines` counts the Discount boxes for that reason.
 */

const ITEM = hospitalItem('EDIT DISCHARGED IPD SERVICES');

test.describe('EDIT DISCHARGED IPD SERVICES @regression', () => {
  const packed = cases(ITEM, opensFromDrawer(), dischargedEdit());
  packed.forEach(({ title, run }) => test(title, run));
  let next = packed.length + 1;

  test(caseId(ITEM, next++) + ' a discharged bill loads its services by invoice number', async ({
    page,
  }) => {
    test.setTimeout(240_000);

    const invoice = await recentDischargedInvoice(page);
    test.skip(invoice === '', 'no patient has been discharged in the last thirty days');

    const screen = new DischargedEditPage(page, ITEM);
    await screen.openScreen();

    const name = await screen.loadInvoice(invoice);

    expect(name, `invoice ${invoice} loaded no patient`).not.toBe('');
    // A discharged inpatient has been charged for something, so the bill has lines - each
    // with its own discount box, which is what makes this screen an editor and not a report.
    await expect(screen.lines.first(), `invoice ${invoice} loaded no services`).toBeVisible({
      timeout: 60_000,
    });

    test.info().annotations.push({
      type: 'discharged bill',
      description: `${invoice} (${name}) - ${await screen.lines.count()} service lines`,
    });
  });

  test(caseId(ITEM, next++) + ' an invoice number matching nobody loads nobody, and says nothing', async ({
    page,
  }) => {
    /**
     * A finding, pinned as it behaves.
     *
     * Type an invoice number that does not exist and the screen does not answer: no
     * message, no empty state, no "not found". It looks exactly like a screen that has not
     * finished loading, which on a slow host is what a clerk will assume - and then they
     * retype it, and assume it again.
     *
     * The case asserts the silence so the suite stays green and the gap stays visible.
     */
    const screen = new DischargedEditPage(page, ITEM);
    await screen.openScreen();

    const name = await screen.loadInvoice('99999999999', 20_000);

    expect(name, 'a nonsense invoice number loaded a patient').toBe('');
    await expect(screen.lines).toHaveCount(0);

    // And nothing on screen says why.
    await expect(
      page.getByText(/not found|no record|no such|invalid/i),
      'the screen has grown a not-found message - this case can become the assertion it wants to be'
    ).toHaveCount(0);
  });

  test(caseId(ITEM, next++) + ' the patient on a discharged bill cannot be typed over', async ({
    page,
  }) => {
    /**
     * The identity of the patient whose bill is being corrected is not something a clerk
     * can retype - the right answer, and the same answer the rest of the module gives by a
     * third mechanism.
     *
     * The module now has three ways of protecting one box: the admission screens disable
     * it, the ward screens mark it readonly, and these disable it again. `readOnly` alone
     * is false here, which is why this asserts the behaviour - can this be typed into -
     * rather than the attribute.
     */
    const screen = new DischargedEditPage(page, ITEM);
    await screen.openScreen();

    await expect(screen.patientName, 'the discharged patient name box takes typing').toBeDisabled();
  });
});
