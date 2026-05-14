/* Layout primitives — PageShell, PageHeader, GlassCard, KpiCard.
   Theme-aware via CSS vars. */

function PageShell({ children, maxWidth = 1400 }) {
  return (
    <div style={{
      padding: 24,
      maxWidth,
      width: '100%',
      margin: '0 auto',
      minWidth: 0,
    }} className="page-enter">{children}</div>
  );
}

function PageHeader({ title, subtitle, icon, actions, mb = 32 }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'flex-start', marginBottom: mb,
      gap: 16, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: '1 1 auto', minWidth: 280 }}>
        {icon}
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{
            fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 800,
            letterSpacing: '-0.03em', lineHeight: 1.15, color: 'var(--text-primary)',
            margin: 0,
          }}>{title}</h1>
          {subtitle && (
            <div style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 13, lineHeight: 1.5 }}>{subtitle}</div>
          )}
        </div>
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{actions}</div>
      )}
    </div>
  );
}

function PageHeaderIcon({ name, gradient = 'linear-gradient(135deg, #1F3FFE, #000F64)' }) {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 12,
      background: gradient,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 20px rgba(31,63,254,0.3)',
      color: '#FFF', flexShrink: 0,
    }}>
      <Icon name={name} size={20} stroke={1.85} color="#FFF" />
    </div>
  );
}

function GlassCard({ children, hover = true, glow = false, accent = false, padding = 20, style, onClick }) {
  const [over, setOver] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      style={{
        position: 'relative',
        background: 'var(--bg-surface)',
        borderRadius: 16,
        border: '1px solid ' + (hover && over ? 'var(--border-brand)' : 'var(--border-subtle)'),
        boxShadow: hover && over ? 'var(--shadow-hover)' : 'var(--shadow-card)',
        transform: hover && over ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all 0.18s ease',
        padding,
        overflow: 'hidden',
        minWidth: 0,
        ...style,
      }}
    >
      {glow && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(to right, transparent, var(--accent-primary), transparent)',
          opacity: 0.55, zIndex: 1,
        }} />
      )}
      {accent && (
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: 3,
          background: 'var(--accent-primary)', borderRadius: '16px 0 0 16px',
        }} />
      )}
      {children}
    </div>
  );
}

function KpiCard({ label, value, unit, decimals = 0, accent, helpText, trend, trendValue, iconName }) {
  const accentColor = accent || 'var(--accent-primary)';
  const trendColor = trend === 'up' ? 'var(--status-good)' : trend === 'down' ? 'var(--status-bad)' : 'var(--text-muted)';
  return (
    <GlassCard padding={20}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Eyebrow style={{ marginBottom: 14, lineHeight: 1.25 }}>{label}</Eyebrow>
        {iconName && (
          <div style={{ color: 'var(--text-muted)', opacity: 0.45 }}>
            <Icon name={iconName} size={16} stroke={1.75} color="currentColor" />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 26, fontWeight: 800, color: accentColor,
          letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
        }}>{value != null ? Number(value).toFixed(decimals) : '—'}</span>
        {unit && <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
      {(helpText || trendValue) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 11 }}>
          {trendValue && <span style={{ color: trendColor, fontWeight: 600 }}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : ''} {trendValue}
          </span>}
          {helpText && <span style={{ color: 'var(--text-muted)' }}>{helpText}</span>}
        </div>
      )}
    </GlassCard>
  );
}

Object.assign(window, { PageShell, PageHeader, PageHeaderIcon, GlassCard, KpiCard });
