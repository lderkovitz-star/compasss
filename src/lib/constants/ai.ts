/**
 * AI Constants — Single Source of Truth
 * The Claude model used for every Anthropic call. The API request and the
 * label on Admin -> Settings both read it from here, so they cannot disagree.
 */

export const ANTHROPIC_MODEL = 'claude-sonnet-5-5';
