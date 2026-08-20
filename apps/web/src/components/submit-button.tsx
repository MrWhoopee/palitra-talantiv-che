'use client';

import { useFormStatus } from 'react-dom';

/**
 * Disabled while the action is in flight, which is what stops a second
 * registration from being submitted by an impatient double click.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className = 'auth-submit',
}: {
  children: string;
  pendingLabel: string;
  /** The auth forms want a full-width button; a panel wants an ordinary one. */
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
