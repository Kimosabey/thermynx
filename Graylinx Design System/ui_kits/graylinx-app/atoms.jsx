/* Atoms — buttons, fields, pills, status pulse, chips
   All colors via CSS vars so light/dark themes flip cleanly. */

function Btn({ variant = 'solid', size = 'sm', children, onClick, disabled, type = 'button', style, leftIcon, ...rest }) {
  const base = {
    fontFamily: 'inherit',
    fontWeight: 600,
    border: 'none',
    borderRadius: 10,
    letterSpacing: '-0.01em',
    transition: 'all 0.18s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
  const sizes = {
    sm: { fontSize: 13, padding: '8px 16px' },
    xs: { fontSize: 12, padding: '6px 12px' },
    md: { fontSize: 14, padding: '10px 20px' },
  };
  const variants = {
    solid:   { background: 'var(--accent-primary)', color: 'var(--text-inverse)' },
    outline: { background: 'transparent', color: 'var(--text-primary)', border: '1.5px solid var(--border-strong)' },
    ghost:   { background: 'transparent', color: 'var(--text-secondary)' },
    danger:  { background: 'rgba(239,68,68,0.08)', color: 'var(--status-bad)', border: '1px solid rgba(239,68,68,0.3)' },
    glass:   { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.88)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)' },
  };
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const hoverStyles = {
    solid:   { background: 'var(--brand-600)', boxShadow: 'var(--shadow-brand)', transform: press ? 'translateY(0)' : 'translateY(-1px)' },
    outline: { borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)', background: 'var(--bg-elevated)' },
    ghost:   { background: 'var(--bg-elevated)', color: 'var(--text-primary)' },
    danger:  { background: 'rgba(239,68,68,0.15)' },
    glass:   { background: 'rgba(255,255,255,0.14)', borderColor: 'rgba(31,63,254,0.5)', transform: press ? 'translateY(0)' : 'translateY(-1px)' },
  };
  // solid btn: white text in both modes (it sits on brand-500)
  if (variant === 'solid') variants.solid.color = '#FFFFFF';
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{ ...base, ...sizes[size], ...variants[variant], ...(hover && !disabled ? hoverStyles[variant] : {}), ...style }}
      {...rest}
    >
      {leftIcon}{children}
    </button>
  );
}

function IconBtn({ children, onClick, ariaLabel, active = false, style }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 34, height: 34, borderRadius: 10,
        background: 'var(--bg-surface)',
        border: '1px solid ' + (hover || active ? 'var(--accent-primary)' : 'var(--border-subtle)'),
        color: hover || active ? 'var(--accent-primary)' : 'var(--text-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.15s',
        ...style,
      }}
    >{children}</button>
  );
}

function Pill({ children, tone = 'neutral', size = 'sm', style }) {
  const tones = {
    neutral: { bg: 'var(--bg-surface)',          color: 'var(--text-muted)',  border: 'var(--border-subtle)' },
    brand:   { bg: 'rgba(31,63,254,0.12)',        color: 'var(--text-brand)',  border: 'rgba(31,63,254,0.30)' },
    good:    { bg: 'rgba(5,150,105,0.12)',        color: 'var(--status-good)', border: 'rgba(5,150,105,0.28)' },
    warn:    { bg: 'rgba(245,158,11,0.14)',       color: 'var(--status-warn)', border: 'rgba(245,158,11,0.30)' },
    bad:     { bg: 'rgba(239,68,68,0.14)',        color: 'var(--status-bad)',  border: 'rgba(239,68,68,0.30)' },
    muted:   { bg: 'var(--bg-elevated)',          color: 'var(--text-muted)',  border: 'var(--border-subtle)' },
  };
  const t = tones[tone];
  const sizes = { sm: { fontSize: 10, padding: '3px 8px' }, md: { fontSize: 11, padding: '4px 10px' } };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontWeight: 700, letterSpacing: '0.04em',
      background: t.bg, color: t.color,
      border: `1px solid ${t.border}`,
      borderRadius: 6,
      fontVariantNumeric: 'tabular-nums',
      ...sizes[size], ...style,
    }}>{children}</span>
  );
}

function StatusDot({ active = true, size = 8 }) {
  const color = active ? 'var(--status-good)' : 'var(--text-faint)';
  return (
    <span style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'inline-block' }}>
      {active && <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: color, opacity: 0.4,
        animation: 'pulse-halo 2s ease-in-out infinite',
      }} />}
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }} />
    </span>
  );
}

function ThinkingDots({ color = 'var(--accent-primary)', size = 5 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: size, height: size, borderRadius: '50%', background: color,
          animation: `thinking-dot 0.9s ease-in-out infinite`,
          animationDelay: `${i * 0.15}s`,
        }} />
      ))}
    </span>
  );
}

function Field({ as = 'select', value, onChange, options, placeholder, rows, children, style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const common = {
    background: 'var(--bg-surface)',
    border: '1px solid ' + (focus ? 'var(--accent-primary)' : hover ? 'var(--border-strong)' : 'var(--border-subtle)'),
    borderRadius: 10,
    fontFamily: 'inherit',
    fontSize: 13,
    color: 'var(--text-primary)',
    padding: '9px 12px',
    width: '100%',
    outline: 'none',
    boxShadow: focus ? '0 0 0 3px rgba(31,63,254,0.18)' : 'none',
    transition: 'all 0.15s',
    ...style,
  };
  if (as === 'textarea') {
    return (
      <textarea
        value={value} onChange={onChange} rows={rows || 3} placeholder={placeholder}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{ ...common, resize: 'vertical' }} {...rest}
      />
    );
  }
  return (
    <select
      value={value} onChange={onChange}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={common} {...rest}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options ? options.map(o => <option key={o.value} value={o.value}>{o.label}</option>) : children}
    </select>
  );
}

function Chip({ children, onClick, active = false, accentColor }) {
  // accentColor falls back to brand on hover/active; otherwise tones default
  const [hover, setHover] = React.useState(false);
  const showAccent = hover || active;
  const accent = accentColor || 'var(--accent-primary)';
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontSize: 11,
        color: showAccent ? accent : 'var(--text-muted)',
        background: showAccent ? 'var(--accent-glow)' : 'var(--bg-surface)',
        border: '1px solid ' + (showAccent ? accent : 'var(--border-subtle)'),
        borderRadius: 9999,
        padding: '6px 12px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        fontFamily: 'inherit',
        textAlign: 'left',
        lineHeight: 1.4,
      }}
    >{children}</button>
  );
}

function Eyebrow({ children, style }) {
  return (
    <p style={{
      margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.10em', ...style,
    }}>{children}</p>
  );
}

Object.assign(window, { Btn, IconBtn, Pill, StatusDot, ThinkingDots, Field, Chip, Eyebrow });
