'use client';

import { useFormStatus } from 'react-dom';

/**
 * Disabled while the action is in flight, which is what stops a second
 * registration from being submitted by an impatient double click.
 */
export function SubmitButton({
  children,
  pendingLabel,
}: {
  children: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="auth-submit" disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
