/* Sidebar — dark navy, 4 nav groups, collapsible */

const NAV_GROUPS = [
  { label: 'Monitor', items: [
    { label: 'Dashboard',    route: 'dashboard', icon: 'layout-dashboard' },
    { label: 'AI Analyzer',  route: 'analyzer',  icon: 'message-square-text' },
  ]},
  { label: 'Intelligence', items: [
    { label: 'Efficiency',   route: 'efficiency', icon: 'zap' },
    { label: 'Anomalies',    route: 'anomalies',  icon: 'triangle-alert' },
    { label: 'Forecast',     route: 'forecast',   icon: 'trending-up' },
    { label: 'Compare',      route: 'compare',    icon: 'columns-2' },
  ]},
  { label: 'Advanced', items: [
    { label: 'Maintenance',  route: 'maintenance', icon: 'wrench' },
    { label: 'Cost',         route: 'cost',        icon: 'indian-rupee' },
    { label: 'Reports',      route: 'reports',     icon: 'file-text' },
  ]},
  { label: 'AI & Knowledge', items: [
    { label: 'AI Agents',    route: 'agent',       icon: 'bot' },
    { label: 'Knowledge',    route: 'rag',         icon: 'book-open' },
  ]},
];

function ThemeSegmented({ theme, onChange, collapsed }) {
  const SUN = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
    </svg>
  );
  const MOON = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );

  if (collapsed) {
    const next = theme === 'dark' ? 'light' : 'dark';
    return (
      <button
        onClick={() => onChange(next)}
        aria-label={`Switch to ${next} theme`}
        title={`Switch to ${next} theme`}
        style={{
          width: 28, height: 28, borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.10)',
          background: 'rgba(31,63,254,0.18)',
          color: '#93A8FF',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(31,63,254,0.5)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; }}
      >
        {theme === 'dark' ? MOON : SUN}
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      style={{
        position: 'relative',
        display: 'inline-flex',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 9999,
        padding: 2,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 2, bottom: 2, width: 'calc(50% - 2px)',
          left: theme === 'light' ? 2 : '50%',
          background: 'rgba(31,63,254,0.35)',
          border: '1px solid rgba(31,63,254,0.55)',
          borderRadius: 9999,
          boxShadow: '0 4px 12px rgba(5,17,242,0.4)',
          transition: 'left 0.22s cubic-bezier(0.25,0.46,0.45,0.94)',
          pointerEvents: 'none',
        }}
      />
      {[
        { id: 'light', label: 'Light', icon: SUN },
        { id: 'dark',  label: 'Dark',  icon: MOON },
      ].map(opt => {
        const active = opt.id === theme;
        return (
          <button
            key={opt.id}
            role="radio"
            aria-checked={active}
            aria-label={`${opt.label} theme`}
            onClick={() => onChange(opt.id)}
            style={{
              position: 'relative', zIndex: 1,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 11px',
              border: 'none', borderRadius: 9999,
              background: 'transparent',
              color: active ? '#FFF' : 'rgba(255,255,255,0.45)',
              fontSize: 11, fontWeight: 600, letterSpacing: '-0.01em',
              cursor: 'pointer', transition: 'color 0.18s',
              fontFamily: 'inherit',
            }}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function NavItem({ item, active, collapsed, onClick }) {
  const [hover, setHover] = React.useState(false);
  const bg = active ? 'rgba(5,17,242,0.18)' : hover ? 'rgba(255,255,255,0.07)' : 'transparent';
  const borderColor = active ? 'rgba(5,17,242,0.3)' : hover ? 'rgba(255,255,255,0.08)' : 'transparent';
  const color = active ? '#93A8FF' : hover ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.55)';
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={collapsed ? item.label : undefined}
      style={{
        display: 'flex', alignItems: 'center',
        gap: 12, padding: collapsed ? '9px 0' : '9px 12px',
        margin: '0 8px', borderRadius: 12,
        justifyContent: collapsed ? 'center' : 'flex-start',
        background: bg,
        border: `1px solid ${borderColor}`,
        color,
        position: 'relative',
        transition: 'all 0.16s ease',
        cursor: 'pointer',
        width: collapsed ? 'calc(100% - 16px)' : 'calc(100% - 16px)',
        fontFamily: 'inherit',
        overflow: 'hidden',
        transform: hover && !active ? 'translateX(2px)' : 'translateX(0)',
      }}
    >
      {active && (
        <span style={{
          position: 'absolute', left: 0, top: '20%', bottom: '20%',
          width: 3, background: '#1F3FFE', borderRadius: 9999,
          boxShadow: '0 0 10px rgba(5,17,242,0.8)',
        }} />
      )}
      <Icon name={item.icon} size={18} stroke={active ? 2 : 1.65} color="currentColor" />
      {!collapsed && (
        <span style={{
          fontSize: 13, fontWeight: active ? 600 : 500,
          letterSpacing: '-0.01em', whiteSpace: 'nowrap',
        }}>{item.label}</span>
      )}
    </button>
  );
}

function Sidebar({ activeRoute, onNavigate, collapsed, onToggleCollapse, theme, onToggleTheme }) {
  const width = collapsed ? 68 : 230;
  return (
    <aside style={{
      width, height: '100vh',
      position: 'sticky', top: 0,
      background: '#06091A',
      display: 'flex', flexDirection: 'column',
      flexShrink: 0,
      borderRight: '1px solid rgba(255,255,255,0.06)',
      boxShadow: 'inset -1px 0 0 rgba(5,17,242,0.15), 4px 0 24px rgba(5,17,242,0.06)',
      transition: 'width 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: 12, padding: collapsed ? '18px 14px' : '18px 18px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: '#FFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          boxShadow: '0 0 0 1px rgba(5,17,242,0.2), 0 4px 12px rgba(5,17,242,0.25)',
        }}>
          <img src="../../assets/logo.png" alt="Graylinx" style={{ width: 28, objectFit: 'contain' }} />
        </div>
        {!collapsed && (
          <div>
            <div style={{
              fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 15,
              color: '#FFF', letterSpacing: '-0.02em', lineHeight: 1.1,
            }}>THERMYNX</div>
            <div style={{
              fontSize: 9, color: 'rgba(255,255,255,0.35)',
              letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 1,
            }}>by Graylinx</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingTop: 8 }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} style={{ marginBottom: 4 }}>
            {!collapsed && (
              <div style={{
                fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.25)',
                letterSpacing: '0.12em', textTransform: 'uppercase',
                padding: gi === 0 ? '8px 20px 4px' : '16px 20px 4px',
              }}>{group.label}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {group.items.map(item => (
                <NavItem
                  key={item.route}
                  item={item}
                  active={activeRoute === item.route}
                  collapsed={collapsed}
                  onClick={() => onNavigate(item.route)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        {!collapsed && (
          <div style={{ padding: '10px 20px', fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
            Unicharm Facility · v0.3.0-poc
          </div>
        )}
        <div style={{
          display: 'flex',
          flexDirection: collapsed ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 8,
          padding: collapsed ? '0 0 12px' : '0 12px 12px',
        }}>
          {/* Theme toggle */}
          <ThemeSegmented theme={theme} onChange={onToggleTheme} collapsed={collapsed} />

          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              width: 28, height: 28, borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.borderColor = 'rgba(31,63,254,0.5)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          >
            <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={14} stroke={2} color="currentColor" />
          </button>
        </div>
      </div>
    </aside>
  );
}

window.Sidebar = Sidebar;
