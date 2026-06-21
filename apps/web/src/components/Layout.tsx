import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from './ui';

function navClass({ isActive }: { isActive: boolean }): string {
  return `rounded-lg px-3 py-1.5 text-sm transition ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`;
}

export function Layout() {
  const auth = useAuth();
  const isAuthenticated = Boolean(auth.user);
  const mainClassName = isAuthenticated
    ? 'mx-auto w-full max-w-5xl flex-1 px-6 py-8'
    : 'w-full flex-1 px-0 py-0';

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Link to={auth.user ? '/dashboard' : '/'} className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">
              C
            </span>
            <span className="text-lg font-semibold tracking-tight">CampusPay</span>
          </Link>
          {auth.user ? (
            <nav className="flex items-center gap-2">
              <NavLink to="/dashboard" className={navClass}>
                Dashboard
              </NavLink>
              {auth.user.role === 'STUDENT' ? (
                <NavLink to="/payments/new" className={navClass}>
                  New payment
                </NavLink>
              ) : null}
              <span className="hidden text-xs text-slate-400 md:inline">
                {auth.user.role.replaceAll('_', ' ')}
              </span>
              <Button variant="ghost" onClick={auth.logout}>
                Sign out
              </Button>
            </nav>
          ) : null}
        </div>
      </header>
      <main className={mainClassName}>
        <Outlet />
      </main>
    </div>
  );
}
