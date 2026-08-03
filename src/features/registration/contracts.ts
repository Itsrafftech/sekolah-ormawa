export const REGISTRATION_DRAFT_SCHEMA_VERSION = 3;

export type UploadReference = {
  id: string;
  kind: "CV" | "PHOTO" | "STUDENT_CARD" | "PORTFOLIO";
  name: string;
  sizeBytes: number;
  mimeType: string;
};

export type PortfolioInput = {
  type: "FILE" | "EXTERNAL_LINK";
  fileUploadId?: string;
  externalUrl?: string;
  title?: string;
  description?: string;
  applicantRole?: string;
  creationYear?: number;
  sortOrder: number;
};

export type RegistrationPayload = {
  periodId: string;
  identity: {
    name: string;
    nim: string;
    cohortCode: number;
    entryYear: number;
    className: string;
    studyProgramId: string;
    phone: string;
    email: string;
    gpa: number;
    domicile: string;
  };
  choices: [
    { departmentId: string; motivation: string },
    { departmentId: string; motivation: string },
  ];
  uploads: {
    cv: UploadReference | null;
    photo: UploadReference | null;
    studentCard: UploadReference | null;
  };
  essays: {
    organizationExperience: string;
    contribution: string;
    academicBalance: string;
  };
  portfolio: PortfolioInput[];
  consent: {
    truthful: boolean;
    processing: boolean;
    version: string;
  };
};

export type RegistrationFormConfig = {
  periodId: string;
  periodName: string;
  cohortCode: number;
  entryYear: number;
  consentVersion: string;
  motivationMinWords: number;
  essayMinWords: number;
  essayMaxWords: number;
  portfolioMaxFiles: number;
  portfolioMaxFileBytes: number;
  portfolioUrlMaxLength: number;
  draftTtlSeconds: number;
  departments: Array<{
    id: string;
    code: string;
    name: string;
    shortName: string;
    requiresPortfolio: boolean;
  }>;
  studyPrograms: Array<{
    id: string;
    code: string;
    name: string;
    isDraft: boolean;
  }>;
};

export type RegistrationSuccessResponse = {
  registrationNumber: string;
  confirmationToken: string;
  confirmationExpiresAt: string;
};
