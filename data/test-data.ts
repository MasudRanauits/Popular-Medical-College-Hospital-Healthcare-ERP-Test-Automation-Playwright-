import { daysAgo, daysAhead, nextRunNumber, randomInt, uniqueSuffix } from '../utils/helpers';

/** Builders keep specs readable and guarantee unique records per run. */
export const patientFactory = (overrides: Partial<Patient> = {}): Patient => ({
  name: `Test Patient ${uniqueSuffix()}`,
  phone: '01700000000',
  gender: 'Male',
  age: '30',
  ...overrides,
});

export interface Patient {
  name: string;
  phone: string;
  gender: string;
  age: string;
}

/** The name every registration run shares, before the run number is appended. */
const REGISTRATION_PATIENT_NAME = 'Masud Rana';

/** Everything the Patient tab of the create-patient wizard needs. */
export interface RegistrationPatient {
  title: string;
  fullName: string;
  gender: string;
  /** The three clicks the MudDatePicker needs; the DOB input itself is readonly. */
  dob: { year: number; month: string; day: number };
  maritalStatus: string;
  religion: string;
  bloodGroup: string;
  mobileNo: string;
  idType: string;
  idNo: string;
  occupation: string;
  /** Enough of the doctor name to bring back one row in the Referred by lookup. */
  referredBy: string;
  district: string;
  thana: string;
}

/**
 * The patient the registration case registers. Every detail is fixed except the name,
 * which carries a run number - "Masud Rana Test-1", "Test-2", and so on - so the records
 * the case leaves in the ERP can be told apart afterwards.
 *
 * Mobile No and IDNo stay fixed on purpose: they are what makes these runs recognisably
 * the same person, and the ERP does not reject a repeat of either.
 *
 * Calling this advances the counter, so call it once per run. Delete
 * playwright/.run-counters.json to start the numbering over at 1.
 */
export function registrationPatient(): RegistrationPatient {
  return {
    title: 'Mr',
    fullName: `${REGISTRATION_PATIENT_NAME} Test-${nextRunNumber('registration')}`,
    gender: 'Male',
    dob: { year: 1998, month: 'Apr', day: 10 },
    maritalStatus: 'Single',
    religion: 'Islam',
    bloodGroup: 'A+',
    mobileNo: '01876765454',
    idType: 'NID',
    idNo: '98876756757',
    occupation: 'Businessman',
    referredBy: 'Rowshon',
    district: 'Tangail',
    thana: 'Bhuapur',
  };
}

/** The contact person entered on the admission wizard, and the admission itself. */
export interface AdmissionData {
  contact: {
    guardianName: string;
    mobile: string;
    relation: string;
    houseNo: string;
    roadNo: string;
    village: string;
    postOffice: string;
    district: string;
    address: string;
  };
  payment: {
    card: string;
    pos: string;
    cardAmount: string;
    cardRemarks: string;
    bkash: string;
    cash: string;
  };
  detail: {
    department: string;
    admittedTo: string;
    /** Enough of a doctor name to bring back rows in each lookup grid. */
    doctorSearch: string;
  };
}

/**
 * One admission's worth of input. The contact-person fields are generated rather than
 * fixed - the admission case fills that tab to prove the fields take input, not to record
 * a particular guardian - and they are numbered off the same run counter as the patient
 * name, so one run's admission reads as one set: "Guardian Test-4", "H-4", "R-4".
 *
 * The payment and department values are the ones the case is actually about, so those are
 * fixed.
 */
export function admissionData(): AdmissionData {
  const n = nextRunNumber('admission');
  return {
    contact: {
      guardianName: `Guardian Test-${n}`,
      // Kept in the 11-digit shape the ERP expects, with the run number in the tail.
      mobile: `018${String(10_000_000 + n).slice(0, 8)}`,
      relation: 'Brother',
      houseNo: `H-${n}`,
      roadNo: `R-${n}`,
      village: `Village-${n}`,
      postOffice: `PO-${n}`,
      district: 'Dhaka',
      address: `Guardian address for run ${n}`,
    },
    payment: {
      card: 'VISA',
      pos: 'EBL POS',
      cardAmount: '1000',
      cardRemarks: `Card advance for run ${n}`,
      bkash: '2000',
      cash: '3000',
    },
    detail: { department: 'HDU', admittedTo: 'HDU', doctorSearch: 'Dr' },
  };
}

/** One medicine indent's worth of input for the Nurse Station. */
export interface MedicineIndentData {
  priority: string;
  /**
   * What goes into the Product Code lookup. One term rather than ten: the catalogue is
   * live, and a term that matches a whole page of brands lets the indent take a different
   * medicine per line without ten separate searches that each have to hit something.
   */
  productSearch: string;
  /** One quantity per line, so the indent's length is however long this is. */
  quantities: number[];
}

/**
 * A medicine indent of `lines` medicines, each in a random quantity.
 *
 * The quantities are random on purpose - a ward orders what it needs, not a round number -
 * and they stay inside 1..10 so a run cannot order a thousand of anything into a live
 * pharmacy. Zero is excluded deliberately: the form refuses it, and that refusal is its
 * own test case rather than something the data should stumble into.
 *
 * The priority varies with the run number so the cases do not file every indent under
 * "Routine", and the run number is what tells one run's indents from another's on the
 * Verify Indent tab.
 */
export function medicineIndent(lines = 10): MedicineIndentData {
  const rotation = ['Routine', 'Urgent', 'Critical Care'];
  return {
    priority: rotation[nextRunNumber('indent') % rotation.length],
    productSearch: 'Tablet',
    quantities: Array.from({ length: lines }, () => randomInt(1, 10)),
  };
}

/** One diet indent's worth of input. */
export interface DietIndentData {
  outlet: string;
  priority: string;
  /**
   * What goes into the Food Pattern Group lookup. One term rather than one per line: the
   * catalogue is live, and a term that matches a whole page of patterns lets an indent
   * take a different one per line without several searches that each have to hit
   * something. A single letter is used because pattern names are phrases - "Normal,
   * DM", "Renal Semi-solid" - with no shared word to search on.
   */
  patternSearch: string;
  /**
   * What goes in the line's Remarks box, and the only thing a case can recognise its own
   * indent by once it reaches Verify Indent.
   *
   * That tab has no search box - Medicine Indent's has one, this one does not - so the
   * grid is read whole and filtered on this. It has to be unique per indent, not per run:
   * several cases here save, and two of them turn on counting how many indents carry the
   * mark.
   */
  mark: string;
  /**
   * How far down the ward list to start looking for a patient.
   *
   * The cases are spread across the ward rather than all indenting for whoever is in the
   * first bed. A patient who already has a food pattern on order cannot be given it again,
   * so a case that saves leaves that patient one pattern poorer - and a suite that always
   * took the first bed would, run after run, work its way through that one patient's
   * choices and then be unable to build an indent at all. Spread this way, each run and
   * each case within it starts from a different bed.
   */
  wardIndex: number;
  /** One quantity per line, so the indent's length is however long this is. */
  quantities: number[];
}

/**
 * A diet indent of `lines` food patterns.
 *
 * The quantities are random inside 1..9 for the same reason the medicine factory's are:
 * a ward orders what it needs. They are carried here so a case can show what it typed,
 * not because the form keeps them - Diet Indent records every line as 1 whatever is sent,
 * which DI-06 covers.
 *
 * The mark carries the run number and a tail of the clock. The run number alone would
 * repeat if playwright/.run-counters.json were deleted, and a mark that repeats would make
 * one run's indent look like a duplicate of another's to the cases that count them.
 */
export function dietIndent(lines = 1): DietIndentData {
  const n = nextRunNumber('diet-indent');
  return {
    outlet: 'Main Outlet',
    priority: ['Routine', 'Emergency', 'Others'][n % 3],
    patternSearch: 'a',
    // Kept well inside the ward list, which runs to a few hundred beds.
    wardIndex: n % 24,
    mark: `DT-${n}-${uniqueSuffix().slice(-7)}`,
    quantities: Array.from({ length: lines }, () => randomInt(1, 9)),
  };
}

/** The date windows a Diet Dashboard case filters on. */
export interface DietDashboardData {
  /** Today, as the filter boxes take it. The dashboard opens on this range. */
  today: string;
  /** A window wide enough to hold more than one day of indents. */
  window: { start: string; end: string };
  /** The same window with its ends swapped - a range the app should refuse. */
  reversed: { start: string; end: string };
  /** A window no indent can fall in, so an empty dashboard is the right answer. */
  future: { start: string; end: string };
  /**
   * A window wide enough that the ward raised more indents in it than either grid will
   * show. A fortnight of a live hospital is well past the 120 rows a grid stops at - five
   * days already fills both - and the dashboard answers it in seconds, where a range of
   * months leaves the host timing out mid-query and taking the session with it.
   */
  wide: { start: string; end: string };
  /** Twice `wide`, for the case that asks whether a wider window brings back more. */
  wider: { start: string; end: string };
}

/**
 * The ranges the Diet Dashboard cases filter on, all relative to the day of the run.
 *
 * Nothing is hard-coded to a date: the dashboard is read-only about history, so a case
 * that named 1 October would pass this month and find an empty ward next month.
 */
export function dietDashboard(): DietDashboardData {
  return {
    today: daysAgo(0),
    window: { start: daysAgo(6), end: daysAgo(0) },
    reversed: { start: daysAgo(0), end: daysAgo(6) },
    future: { start: daysAhead(30), end: daysAhead(37) },
    wide: { start: daysAgo(14), end: daysAgo(0) },
    wider: { start: daysAgo(28), end: daysAgo(0) },
  };
}

/** One consultancy line's worth of input for the Nurse Station. */
export interface ConsultancyServiceData {
  /**
   * How far down the ward list to start looking for a patient.
   *
   * The cases are spread across the ward rather than all billing whoever is in the first
   * bed, for the same reason the diet factory spreads its own: these are live admissions
   * and a suite that always took the first one would put every run's services on one
   * patient's bill. Rotated off the run counter, so each run starts from a different bed.
   */
  wardIndex: number;
  /**
   * What goes into the Service lookup. One term rather than one per line: the catalogue is
   * live, and a term that matches a page of services lets a case take a different one per
   * line without several searches that each have to hit something.
   */
  serviceSearch: string;
  /**
   * A second term, for the cases that need a service the first one does not offer.
   */
  otherServiceSearch: string;
  /** Enough of a doctor name to bring back exactly one row in the Doctor Name lookup. */
  doctorSearch: string;
  /** A term no service or doctor can match, for the empty-result cases. */
  noSuchTerm: string;
  /** One quantity per line, so a case's cart is however long this is. */
  quantities: number[];
  /** A back-dated service date, for the case about the Service Date box. */
  backdated: string;
  /** What the discount box is set to, for the case about Service Change. */
  discount: number;
}

/**
 * One run's worth of consultancy input, all relative to the day of the run.
 *
 * The quantities stay inside 1..3 because these are billed to a live admission: a case
 * that ordered fifty of a consultant's visits would leave a bill somebody has to unpick.
 * Zero is excluded deliberately - the form refuses it, and that refusal is its own case
 * rather than something the data should stumble into.
 */
export function consultancyService(lines = 2): ConsultancyServiceData {
  const n = nextRunNumber('consultancy');
  return {
    // Kept well inside the ward list, which runs to a few hundred beds.
    wardIndex: n % 24,
    serviceSearch: 'Visit',
    otherServiceSearch: 'Charge',
    doctorSearch: 'Rowshon',
    noSuchTerm: `no-such-service-${uniqueSuffix()}`,
    quantities: Array.from({ length: lines }, () => randomInt(1, 3)),
    backdated: daysAgo(3),
    discount: 40,
  };
}
