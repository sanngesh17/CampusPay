import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from './ui';

function navClass({ isActive }: { isActive: boolean }): string {
  return `role-btn ${isActive ? 'active' : ''}`;
}

export function Layout() {
  const auth = useAuth();
  const isAuthenticated = Boolean(auth.user);
  const mainClassName = isAuthenticated ? 'app-container' : 'app-container';

  return (
    <div className={`app-shell ${isAuthenticated ? '' : 'app-shell--public'}`}>
      <header className="app-nav">
        <div className="nav-left">
          <Link to={auth.user ? '/dashboard' : '/'} className="logo-block">
            <span className="logo-dot" />
            <span className="logo-text">CampusPay</span>
          </Link>
        </div>
        {auth.user ? (
          <div className="flex items-center gap-3">
            <nav className="role-switches" aria-label="Primary navigation">
              <NavLink to="/dashboard" className={navClass}>
                Dashboard
              </NavLink>
              {auth.user.role === 'STUDENT' ? (
                <NavLink to="/payments/new" className={navClass}>
                  New payment
                </NavLink>
              ) : null}
            </nav>
            <span className="hidden font-mono text-[10.5px] text-[var(--ink-faint)] md:inline">
              {auth.user.role.replaceAll('_', ' ')}
            </span>
            <Button variant="ghost" onClick={auth.logout}>
              Sign out
            </Button>
          </div>
        ) : (
          <div className="role-switches">
            <span className="role-btn active">Login</span>
          </div>
        )}
      </header>
      <main className={mainClassName}>
        <Outlet />
      </main>
    </div>
  );
}
