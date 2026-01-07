import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NAV_ITEMS, normalizePath } from '../constants/navigation';

const Sidebar = () => {
  const location = useLocation();
  const activePath = useMemo(() => normalizePath(location.pathname), [location.pathname]);

  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });

  const [openGroups, setOpenGroups] = useState(() => {
    const stored = localStorage.getItem('navOpenGroups');
    return stored ? JSON.parse(stored) : {};
  });

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', collapsed);
  }, [collapsed]);

  useEffect(() => {
    localStorage.setItem('navOpenGroups', JSON.stringify(openGroups));
  }, [openGroups]);

  useEffect(() => {
    const parentPath = findParentPath(activePath);
    if (parentPath) {
      setOpenGroups((prev) => ({ ...prev, [parentPath]: true }));
    }
  }, [activePath]);

  const toggleGroup = (path) => {
    setOpenGroups((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} id="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">İT</div>
          <div className="sidebar-logo-text">İş Takip Paneli</div>
        </div>
        <button
          className="sidebar-toggle"
          id="sidebarToggle"
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label="Kenar çubuğunu küçült"
        >
          ☰
        </button>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((section) => (
          <div className="nav-section" key={section.section}>
            <div className="nav-section-title">{section.section}</div>
            {section.items.map((item) =>
              item.collapsible ? (
                <CollapsibleItem
                  key={item.path}
                  item={item}
                  isOpen={openGroups[item.path]}
                  activePath={activePath}
                  onToggle={() => toggleGroup(item.path)}
                />
              ) : (
                <NavLink key={item.path} item={item} isActive={activePath === normalizePath(item.path)} />
              )
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
};

const NavLink = ({ item, isActive }) => (
  <div className="nav-item">
    <Link
      to={item.path}
      className={`nav-link ${isActive ? 'active' : ''}`}
      aria-current={isActive ? 'page' : undefined}
    >
      <span className="nav-link-icon">{item.icon}</span>
      <span className="nav-link-text">{item.label}</span>
    </Link>
  </div>
);

const CollapsibleItem = ({ item, isOpen, activePath, onToggle }) => {
  const isParentActive = normalizePath(item.path) === activePath;
  const hasActiveChild = item.children?.some((child) => normalizePath(child.path) === activePath);
  const open = isOpen || hasActiveChild || isParentActive;

  return (
    <div className={`nav-collapsible ${open ? 'open' : ''}`}>
      <button
        type="button"
        className={`nav-collapsible-trigger ${isParentActive ? 'active' : ''}`}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="nav-collapsible-icon">{item.icon}</span>
        <span className="nav-collapsible-text">{item.label}</span>
        <span className="nav-collapsible-arrow">▸</span>
      </button>
      {open && (
        <div className="nav-collapsible-content">
          {item.children?.map((child) => {
            const childActive = normalizePath(child.path) === activePath;
            return (
              <div className="nav-item" key={child.path}>
                <Link
                  to={child.path}
                  className={`nav-link ${childActive ? 'active' : ''}`}
                  aria-current={childActive ? 'page' : undefined}
                >
                  <span className="nav-link-icon">•</span>
                  <span className="nav-link-text">{child.label}</span>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const findParentPath = (path) => {
  const normalized = normalizePath(path);
  let parent = '';

  NAV_ITEMS.forEach((section) => {
    section.items.forEach((item) => {
      if (item.children?.some((child) => normalizePath(child.path) === normalized)) {
        parent = item.path;
      }
    });
  });

  return parent;
};

export default Sidebar;

