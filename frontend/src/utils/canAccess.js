/**
 * Feature-access rules per subscription plan.
 *
 * Plans (lowest → highest): free < basic < standard < pro
 *
 * @param {object} school        - School object with a `plan` string property.
 * @param {string} feature       - Feature key (see rules below).
 * @param {string|null} expiresAt - ISO date string for subscription expiry, or null.
 * @returns {boolean}
 */
export function canAccess(school, feature, expiresAt = null) {
  if (!school) return false;

  // Check expiry first (null/undefined = no expiry = still valid)
  if (expiresAt) {
    const expires = new Date(expiresAt);
    const today = new Date(new Date().toDateString()); // midnight local
    if (expires < today) return false;
  }

  const rules = {
    mark_entry:   ['free', 'basic', 'standard', 'pro'],
    view_results: ['free', 'basic', 'standard', 'pro'],
    subject_pdf:  ['basic', 'standard', 'pro'],
    subject_csv:  ['standard', 'pro'],
    school_pdf:   ['standard', 'pro'],
    school_csv:   ['standard', 'pro'],
    report_cards: ['standard', 'pro'],
    sms:          ['pro'],
  };

  return rules[feature]?.includes(school.plan) ?? false;
}
