import { normalizeIndianPhoneDigits } from "./phone";

export type TenantProfileCompletionInput = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  occupation_type?: string | null;
  institution_name?: string | null;
  govt_id_type?: string | null;
  govt_id_number?: string | null;
  govt_id_last4?: string | null;
  aadhar_number?: string | null;
  aadhar_last4?: string | null;
  profile_photo_path?: string | null;
  govt_id_front_path?: string | null;
  govt_id_back_path?: string | null;
  aadhar_front_path?: string | null;
  aadhar_back_path?: string | null;
  alternate_id_path?: string | null;
};

export type TenantProfileCompletionResult = {
  percentage: number;
  completeCount: number;
  totalCount: number;
  missingFields: string[];
};

type Requirement = {
  key: string;
  label: string;
  isComplete: (input: TenantProfileCompletionInput) => boolean;
};

const REQUIREMENTS: Requirement[] = [
  {
    key: "full_name",
    label: "Full name",
    isComplete: (input) => Boolean(input.full_name?.trim()),
  },
  {
    key: "email",
    label: "Email",
    isComplete: (input) => Boolean(input.email?.trim()),
  },
  {
    key: "phone",
    label: "Phone number",
    isComplete: (input) => {
      const normalizedPhone = normalizeIndianPhoneDigits(input.phone ?? "");
      return /^\d{10}$/.test(normalizedPhone);
    },
  },
  {
    key: "occupation_type",
    label: "Occupation type",
    isComplete: (input) => Boolean(input.occupation_type?.trim()),
  },
  {
    key: "institution_name",
    label: "Institution name",
    isComplete: (input) => Boolean(input.institution_name?.trim()),
  },
  {
    key: "profile_photo_path",
    label: "Profile picture",
    isComplete: (input) => Boolean(input.profile_photo_path?.trim()),
  },
  {
    key: "govt_id_front_path",
    label: "Government ID front image",
    isComplete: (input) =>
      Boolean(
        input.govt_id_front_path?.trim() ||
          input.aadhar_front_path?.trim(),
      ),
  },
  {
    key: "govt_id_back_path",
    label: "Government ID back image",
    isComplete: (input) =>
      Boolean(
        input.govt_id_back_path?.trim() ||
          input.aadhar_back_path?.trim(),
      ),
  },
];

export function getTenantProfileCompletion(
  input: TenantProfileCompletionInput,
): TenantProfileCompletionResult {
  const missingFields = REQUIREMENTS.filter((r) => !r.isComplete(input)).map(
    (r) => r.label,
  );

  const totalCount = REQUIREMENTS.length;
  const completeCount = totalCount - missingFields.length;
  const percentage = Math.round((completeCount / totalCount) * 100);

  return {
    percentage,
    completeCount,
    totalCount,
    missingFields,
  };
}
