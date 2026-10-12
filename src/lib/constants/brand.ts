/**
 * Brand Constants — Single Source of Truth
 * All platform branding strings must be imported from here.
 * Never hardcode brand names in components directly.
 */

export const BRAND_NAME = 'Compass';
export const BRAND_TAGLINE = 'Executive Simulation & Behavioral Assessment Platform';
export const BRAND_SHORT = 'Compass';
export const SUPPORT_EMAIL = 'support@continentalworks.com';
export const ADMIN_EMAIL_DEFAULT = 'admin@continentalworks.com';
export const BRAND_COPYRIGHT = `© ${new Date().getFullYear()} Compass`;


/**
 * The platform name is stored in the database and can be edited under
 * Admin -> Settings. Rows created before the rename still hold the old name,
 * so treat those - and blank values - as "use the current brand name".
 */
const LEGACY_BRAND_NAMES = ['cognitiveedge', 'cognitiveed'];

export function resolveBrandName(platformName?: string | null): string {
  const name = platformName?.trim();
  if (!name || LEGACY_BRAND_NAMES.includes(name.toLowerCase())) return BRAND_NAME;
  return name;
}

const LEGACY_SUPPORT_EMAILS = ['support@cognitiveedge.com', 'support@compass.com'];

export function resolveSupportEmail(supportEmail?: string | null): string {
  const email = supportEmail?.trim();
  if (!email || LEGACY_SUPPORT_EMAILS.includes(email.toLowerCase())) return SUPPORT_EMAIL;
  return email;
}
