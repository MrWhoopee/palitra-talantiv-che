export function FormAlert({ tone, children }: { tone: 'error' | 'ok'; children: string }) {
  return (
    <p
      className={`auth-alert ${tone === 'error' ? 'auth-alert-error' : 'auth-alert-ok'}`}
      // `assertive` for a failure the person is waiting on, `polite` for a
      // confirmation that can wait for a pause in speech.
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </p>
  );
}
