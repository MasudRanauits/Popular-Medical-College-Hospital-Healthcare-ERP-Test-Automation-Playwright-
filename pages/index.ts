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
