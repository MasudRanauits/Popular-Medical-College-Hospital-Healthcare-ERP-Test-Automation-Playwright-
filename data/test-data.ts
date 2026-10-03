import { nextRunNumber, randomInt, uniqueSuffix } from '../utils/helpers';

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
