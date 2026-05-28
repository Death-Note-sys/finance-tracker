import { NavLink, useLocation } from 'react-router-dom';
import {
  HiOutlineChartBar,
  HiOutlineCreditCard,
  HiOutlineCash,
  HiOutlineUsers,
  HiOutlineLogout,
  HiOutlineMenu,
  HiX,
  HiOutlineSave
} from 'react-icons/hi';
import { useAuth } from '../../context/AuthContext';
import { getCurrencies } from '../../utils/currency';
import './Sidebar.css';

const NAV_LINKS = [
  { to: '/', icon: HiOutlineChartBar, label: 'Dashboard', end: true },
  { to: '/expenses', icon: HiOutlineCreditCard, label: 'Expenses' },
  { to: '/income', icon: HiOutlineCash, label: 'Income' },
  { to: '/savings', icon: HiOutlineSave, label: 'Savings' },
  { to: '/borrowing', icon: HiOutlineUsers, label: 'Borrowing' },
];

function Sidebar({ isOpen, onToggle }) {
  const { user, logout, currency, setCurrency } = useAuth();
  const location = useLocation();
  const currencies = getCurrencies();

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      {/* Mobile toggle */}
      <button className="sidebar-toggle" onClick={onToggle}>
        {isOpen ? <HiX /> : <HiOutlineMenu />}
      </button>

      {/* Mobile overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={onToggle} />}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">₹</div>
          <span className="sidebar-logo-text">FinanceFlow</span>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <p className="sidebar-nav-label">Menu</p>
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
              onClick={() => {
                if (window.innerWidth <= 768) onToggle();
              }}
            >
              <span className="sidebar-link-icon">
                <link.icon />
              </span>
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Currency Selector */}
        <div className="sidebar-currency">
          <p className="sidebar-currency-label">Currency</p>
          <select
            className="sidebar-currency-select"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* User Info */}
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {getInitials(user?.username || user?.email)}
          </div>
          <div className="sidebar-user-info">
            <p className="sidebar-user-name">{user?.username || 'User'}</p>
            <p className="sidebar-user-email">{user?.email || ''}</p>
          </div>
          <button
            className="sidebar-logout-btn"
            onClick={logout}
            title="Logout"
          >
            <HiOutlineLogout />
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
