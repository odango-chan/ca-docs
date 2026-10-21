/**
 * Pin all subsequent source reads to the immutable commit resolved from a moving ref.
 * Keep the human-facing ref separately for snapshot provenance.
 */
export function pinSourceContext(context, revision) {
  if (!revision || typeof revision.commit !== 'string' || !/^[0-9a-f]{40}$/i.test(revision.commit)) {
    throw new Error(`source ref ${context?.ref || '(unknown)'} did not resolve to an immutable commit SHA`);
  }
  return {
    ...context,
    ref: revision.commit,
    sourceRef: context.sourceRef || context.ref,
  };
}
