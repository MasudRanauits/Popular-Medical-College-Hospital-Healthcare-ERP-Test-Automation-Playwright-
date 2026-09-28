import { uniqueSuffix } from '../utils/helpers';

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
