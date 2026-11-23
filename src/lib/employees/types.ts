export type EmployeeWeekday = {
  weekday: number;
  available: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

export type EmployeeException = {
  id: string;
  workDate: string;
  available: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

export type EmployeeNote = {
  id: string;
  body: string;
  visibleToEmployee: boolean;
  createdAt: string;
  authorName: string;
};

export type EmployeePerson = {
  userId: string;
  accountId: string;
  firstName: string;
  lastName: string;
  roleName: string;
  status: "active" | "disabled";
  isOwner: boolean;
  phone: string;
  address: string;
  emergencyName: string;
  emergencyPhone: string;
  other: string;
  weekdays: EmployeeWeekday[];
  exceptions: EmployeeException[];
  evaluations: EmployeeNote[];
  comments: EmployeeNote[];
};

export type EmployeeCopy = {
  locale: string;
  title: string;
  mine: string;
  deniedTitle: string;
  deniedBody: string;
  selfDeniedTitle: string;
  selfDeniedBody: string;
  seeAccount: string;
  saved: string;
  notProvided: string;
  information: string;
  phone: string;
  address: string;
  emergency: string;
  emergencyName: string;
  emergencyPhone: string;
  other: string;
  availability: string;
  week: string;
  weekHint: string;
  exceptions: string;
  exceptionHint: string;
  exceptionDate: string;
  available: string;
  unavailable: string;
  from: string;
  to: string;
  hour: string;
  minute: string;
  addException: string;
  noExceptions: string;
  remove: string;
  evaluations: string;
  comments: string;
  addEvaluation: string;
  addComment: string;
  noteBody: string;
  employeeCanSee: string;
  hiddenFromEmployee: string;
  emptyNotes: string;
  sharedEmpty: string;
  save: string;
  saving: string;
  statusActive: string;
  statusDisabled: string;
  staff: string;
  ownerRole: string;
  days: string[];
  errors: {
    invalid: string;
    forbidden: string;
    unavailable: string;
    failed: string;
    not_found: string;
  };
};
