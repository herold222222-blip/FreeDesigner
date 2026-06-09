export type ProfileGender = "male" | "female";

export const DEFAULT_AVATAR_MALE_PATH = "/defaults/avatar-male.svg";
export const DEFAULT_AVATAR_FEMALE_PATH = "/defaults/avatar-female.svg";
export const DEFAULT_ORG_LOGO_PATH = "/defaults/org-logo.png";

export function defaultAvatarForGender(gender: ProfileGender): string {
  return gender === "female" ? DEFAULT_AVATAR_FEMALE_PATH : DEFAULT_AVATAR_MALE_PATH;
}

export function resolveRegistrationAvatar(params: {
  avatar?: string;
  gender?: ProfileGender;
  useOrgLogo?: boolean;
  name?: string;
}): string {
  const trimmed = params.avatar?.trim();
  if (trimmed) return trimmed;
  if (params.useOrgLogo) return DEFAULT_ORG_LOGO_PATH;
  if (params.gender) return defaultAvatarForGender(params.gender);
  return defaultAvatarForGender("male");
}
