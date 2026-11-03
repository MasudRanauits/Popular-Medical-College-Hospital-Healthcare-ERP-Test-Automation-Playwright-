export { BasePage } from './base.page';
export { LoginPage } from './login.page';
export { HomePage } from './home.page';
export { RegistrationPage, CreatePatientPage } from './registration.page';
export { AdmissionPage } from './admission.page';
export { AdmissionDashboardPage } from './admission-dashboard.page';
export type { PrintedDocument } from './admission-dashboard.page';
export { NurseStationPage } from './nurse-station.page';
export type { WardPatient, IndentPatient, IndentLine, VerifiedIndent } from './nurse-station.page';
export { DietIndentPage } from './diet-indent.page';
export type {
  DietWardPatient,
  DietPatient,
  DietLine,
  DietIndentRow,
  DietAttempt,
  PatternPick,
} from './diet-indent.page';
export { DietDashboardPage } from './diet-dashboard.page';
export type { DietDashboardRow, DietGrid, DietActionOutcome } from './diet-dashboard.page';
export { ConsultancyServicePage } from './consultancy-service.page';
export type {
  ConsultancyWardPatient,
  ConsultancyPatient,
  ServiceOption,
  CartLine,
  ServedLine,
  LineAttempt,
  LineInput,
} from './consultancy-service.page';
export { IpdServiceEntryPage } from './ipd-service-entry.page';
export type {
  IpdWardPatient,
  IpdPatient,
  IpdServiceOption,
  IpdCartLine,
  IpdBilledLine,
  IpdLineAttempt,
  IpdLineInput,
} from './ipd-service-entry.page';
export {
  HospitalMenuPage,
  HospitalScreenPage,
  HOSPITAL_MENU,
  hospitalArea,
  hospitalItem,
  escapeRegExp,
} from './hospital-menu.page';
export type { HospitalMenuItem, HospitalArea } from './hospital-menu.page';
export { HospitalGridPage } from './hospital-grid.page';
export type { GridSnapshot } from './hospital-grid.page';
export { HospitalPatientScreenPage } from './hospital-patient-screen.page';
export type { AdmissionRow, PatientPanel } from './hospital-patient-screen.page';
export { HospitalDateDashboardPage } from './hospital-date-dashboard.page';
export { CabinDashboardPage } from './cabin-dashboard.page';
export type { BedTile, BedState } from './cabin-dashboard.page';
export { HospitalWardScreenPage } from './hospital-ward-screen.page';
export type { WardLookupRow, WardPatientPanel } from './hospital-ward-screen.page';
export { BillChangeHistoryPage } from './bill-change-history.page';
export type { BillChangeRow } from './bill-change-history.page';
export { DischargedEditPage } from './discharged-edit.page';
export { HospitalUhidScreenPage } from './hospital-uhid-screen.page';
export type { UhidLookupRow } from './hospital-uhid-screen.page';
