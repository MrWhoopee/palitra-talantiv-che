import { logoutAction } from '@/app/actions/auth';

/**
 * A form rather than an onClick handler: logging out changes server state, so
 * it must not be reachable by a prefetch or a link a browser may follow on
 * its own - and it keeps working with JavaScript disabled.
 */
export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="link-button">
        Вийти
      </button>
    </form>
  );
}
