/**
 * The intake form has no separate Target Role field. Its placeholder asks the
 * candidate to open the context with "Target Role: <title>", so the reports'
 * Target Role slot is filled from that line.
 *
 * Spaces and tabs only around the colon, never \s: that would match a newline
 * and turn a bare "Target Role:" into whatever the next line says.
 */
export function extractTargetRole(context: string | null | undefined): string | null {
  const match = context?.match(/^[ \t]*target[ \t]+role[ \t]*:[ \t]*(.+?)[ \t]*$/im);
  const title = match?.[1]?.trim();
  return title ? title.slice(0, 120) : null;
}
