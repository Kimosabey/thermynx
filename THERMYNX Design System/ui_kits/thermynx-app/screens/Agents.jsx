/* AI Agents — color-keyed mode cards + active mode config + reasoning trace */

const MODES = [
  {
    id: 'investigator', label: 'Investigator', icon: 'scan-search',
    c: '#1F3FFE', cDeep: '#0123B4', cShadow: 'rgba(31,63,254,0.32)',
    tagline: 'Deep-dive into any equipment issue autonomously',
    placeholder: 'e.g. Something feels off with Chiller 1. Investigate recent performance.',
    presets: [
      'Investigate Chiller 1 efficiency — why is it underperforming?',
      'Chiller 2 seems to have a problem, run a full investigation',
      'Investigate the worst-performing equipment in the plant right now',
    ],
    hasEquipment: true,
  },
  {
    id: 'optimizer', label: 'Optimizer', icon: 'zap',
    c: '#10b981', cDeep: '#047857', cShadow: 'rgba(16,185,129,0.32)',
    tagline: 'Find actionable ways to cut energy consumption today',
    placeholder: 'e.g. How can I reduce energy consumption at the plant today?',
    presets: [
      'How can I reduce total kWh consumption this shift?',
      'Which equipment is wasting the most energy and what should I do?',
      'Give me a prioritized list of energy saving actions for today',
    ],
    hasEquipment: false,
  },
  {
    id: 'brief', label: 'Daily Brief', icon: 'calendar-check',
    c: '#7c3aed', cDeep: '#5b21b6', cShadow: 'rgba(124,58,237,0.32)',
    tagline: 'Start-of-shift plant status briefing — no input required',
    placeholder: 'Optional: focus area (e.g. overnight performance, energy spike at 2AM)',
    presets: [
      'Generate a complete plant status briefing for shift handover',
      'What happened overnight? Any issues I should know about?',
    ],
    hasEquipment: false,
  },
  {
    id: 'root_cause', label: 'Root Cause', icon: 'microscope',
    c: '#f59e0b', cDeep: '#b45309', cShadow: 'rgba(245,158,11,0.34)',
    tagline: 'Diagnose the root cause of a specific fault or anomaly',
    placeholder: 'e.g. Chiller 1 kW/TR spiked to 0.95 at 14:30. What caused it?',
    presets: [
      'Chiller 1 efficiency degraded 15% over the last 24 hours — why?',
      'Condenser water delta-T is unusually low on Chiller 2 — diagnose',
      'Why did energy consumption spike between 2PM-4PM today?',
    ],
    hasEquipment: true,
  },
  {
    id: 'maintenance', label: 'Maintenance', icon: 'wrench',
    c: '#f97316', cDeep: '#c2410c', cShadow: 'rgba(249,115,22,0.34)',
    tagline: 'AI-generated maintenance plan based on current equipment data',
    placeholder: 'e.g. Plan maintenance priorities for this week based on current equipment health',
    presets: [
      'Create a prioritized maintenance plan for this week',
      'Which equipment needs attention most urgently based on performance data?',
    ],
    hasEquipment: true,
  },
];

function ModeCard({ mode, selected, onClick }) {
  const [hover, setHover] = React.useState(false);
  const showAccent = selected || hover;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        background: selected
          ? `linear-gradient(180deg, ${mode.c}14 0%, #FFFFFF 70%)`
          : 'var(--bg-surface)',
        border: '1px solid ' + (showAccent ? 'transparent' : 'var(--border-subtle)'),
        borderRadius: 16, padding: '16px 14px 14px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 180ms cubic-bezier(0.25,0.46,0.45,0.94)',
        boxShadow: showAccent
          ? `0 8px 24px ${mode.c}1F`
          : '0 1px 2px rgba(31,63,254,0.04)',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        fontFamily: 'inherit',
        isolation: 'isolate',
      }}
    >
      {showAccent && (
        <div style={{
          position: 'absolute', inset: '-40% 30% auto 30%', height: 64,
          background: `radial-gradient(ellipse at top, ${mode.c}3D, transparent 70%)`,
          zIndex: -1, pointerEvents: 'none',
        }} />
      )}
      {showAccent && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 16, padding: 1,
          background: `linear-gradient(180deg, ${mode.c} 0%, transparent 60%)`,
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor', maskComposite: 'exclude',
          pointerEvents: 'none',
        }} />
      )}
      <div style={{
        width: 36, height: 36, borderRadius: 11,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--bg-surface)',
        background: `linear-gradient(135deg, ${mode.c} 0%, ${mode.cDeep} 100%)`,
        boxShadow: `0 6px 14px ${mode.cShadow}`,
        marginBottom: 12,
      }}>
        <Icon name={mode.icon} size={17} stroke={2} color="#FFF" />
      </div>
      {selected && (
        <span style={{
          position: 'absolute', top: 14, right: 14,
          width: 18, height: 18, borderRadius: 9999,
          background: mode.c, color: 'var(--bg-surface)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="check" size={10} stroke={3} color="#FFF" />
        </span>
      )}
      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
        {mode.label}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.45, marginTop: 4 }}>
        {mode.tagline}
      </div>
    </button>
  );
}

// Shimmer text for running trace step (Claude-style)
function ShimmerText({ children }) {
  return (
    <span style={{
      backgroundImage: 'linear-gradient(90deg, #1D1D21 0%, #1D1D21 35%, #6671FF 45%, #1F3FFE 50%, #6671FF 55%, #1D1D21 65%, #1D1D21 100%)',
      backgroundSize: '200% 100%',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      color: 'transparent',
      animation: 'shimmer-text 2.1s linear infinite',
      fontSize: 12, fontWeight: 600,
    }}>{children}</span>
  );
}

const TRACE_TOOLS = {
  get_equipment_list: { label: 'Equipment List', icon: 'list' },
  compute_efficiency: { label: 'Efficiency Calc', icon: 'zap' },
  detect_anomalies:   { label: 'Anomaly Scan',    icon: 'scan-search' },
  get_timeseries:     { label: 'Timeseries Stats', icon: 'bar-chart-2' },
};

function TraceStep({ frame, mode }) {
  const meta = TRACE_TOOLS[frame.tool] || { label: frame.tool, icon: 'wrench' };
  const status = frame.status; // 'done' | 'running' | 'pending'
  const rowStyles = {
    done:    { background: 'rgba(31,63,254,0.04)', border: '1px solid rgba(31,63,254,0.18)' },
    running: { background: 'var(--bg-surface)',              border: '1px solid rgba(31,63,254,0.30)', boxShadow: '0 4px 14px rgba(31,63,254,0.08)' },
    pending: { background: 'var(--bg-elevated)',              border: '1px solid var(--border-subtle)' },
  };
  const dotStyles = {
    done:    { background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)', color: 'var(--bg-surface)' },
    running: { background: 'var(--bg-surface)',     borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)', animation: 'pulse-halo 1.6s ease-out infinite' },
    pending: { background: 'var(--bg-surface)',     borderColor: 'var(--border-subtle)', color: 'var(--border-subtle)' },
  };
  const toolIconStyles = {
    done:    { background: 'rgba(31,63,254,0.10)', color: 'var(--accent-primary)' },
    running: { background: 'rgba(31,63,254,0.10)', color: 'var(--accent-primary)' },
    pending: { background: 'var(--bg-elevated)',               color: 'var(--text-faint)' },
  };
  return (
    <div style={{ position: 'relative', padding: '8px 0 10px' }}>
      <span style={{
        position: 'absolute', left: -22, top: 14,
        width: 18, height: 18, borderRadius: 9999,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: '1.5px solid', zIndex: 2,
        ...dotStyles[status],
      }}>
        {status === 'done' && <Icon name="check" size={10} stroke={3} color="currentColor" />}
        {status === 'running' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-primary)' }} />}
      </span>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        borderRadius: 12, padding: '9px 12px',
        transition: 'all 180ms ease',
        ...rowStyles[status],
      }}>
        <span style={{
          width: 22, height: 22, borderRadius: 7,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, ...toolIconStyles[status],
        }}>
          <Icon name={meta.icon} size={13} stroke={2} color="currentColor" />
        </span>
        {status === 'running'
          ? <ShimmerText>{frame.runningLabel || `${meta.label}…`}</ShimmerText>
          : <span style={{ fontSize: 12, fontWeight: status === 'pending' ? 500 : 600, color: status === 'pending' ? 'var(--text-faint)' : 'var(--text-primary)' }}>{meta.label}</span>
        }
        <span style={{
          marginLeft: 'auto', display: 'inline-flex', gap: 8, alignItems: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
        }}>
          {frame.step && <span style={{
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 9,
            background: status === 'done' ? 'rgba(31,63,254,0.10)' : status === 'running' ? 'rgba(31,63,254,0.10)' : 'var(--bg-elevated)',
            color: status === 'pending' ? 'var(--text-faint)' : 'var(--accent-primary)',
            padding: '2px 6px', borderRadius: 5, letterSpacing: '0.04em',
          }}>step {frame.step}</span>}
          <span>{frame.meta}</span>
        </span>
      </div>
    </div>
  );
}

function AgentsScreen({ equipment }) {
  const [activeId, setActiveId] = React.useState('investigator');
  const [goal, setGoal]         = React.useState('');
  const [selectedEq, setEq]     = React.useState('');
  const [hours, setHours]       = React.useState(24);
  const [run, setRun]           = React.useState(null); // null | { trace, output, done }
  const mode = MODES.find(m => m.id === activeId);

  function handleRun() {
    if (!goal.trim()) return;
    const trace = [
      { tool: 'get_equipment_list', step: 1, status: 'done',    meta: '240ms · 6 items' },
      { tool: 'compute_efficiency', step: 2, status: 'running', meta: '1.4s', runningLabel: 'Computing efficiency for Chiller 1…' },
      { tool: 'detect_anomalies',   step: 3, status: 'pending', meta: 'queued' },
    ];
    setRun({ trace, output: '', done: false });
    // animate: after 1.8s flip step 2 to done, start step 3
    setTimeout(() => {
      setRun({
        trace: [
          { tool: 'get_equipment_list', step: 1, status: 'done', meta: '240ms · 6 items' },
          { tool: 'compute_efficiency', step: 2, status: 'done', meta: '1.7s · kW/TR 0.612' },
          { tool: 'detect_anomalies',   step: 3, status: 'running', meta: '0.6s', runningLabel: 'Scanning anomalies (z-score)…' },
        ], output: '', done: false,
      });
    }, 1800);
    setTimeout(() => {
      setRun({
        trace: [
          { tool: 'get_equipment_list', step: 1, status: 'done', meta: '240ms · 6 items' },
          { tool: 'compute_efficiency', step: 2, status: 'done', meta: '1.7s · kW/TR 0.612' },
          { tool: 'detect_anomalies',   step: 3, status: 'done', meta: '0.9s · 0 anomalies' },
        ],
        output: `## Investigation summary\n\nChiller 1 is operating **inside the good kW/TR band** (avg 0.612 over 24h). No active anomalies. Two minor patterns:\n\n- Night-time efficiency dips to 0.71 between 02:30–04:00.\n- CH2 short-cycled 4× overnight.\n\n### Recommended actions\n\n1. Raise CT-1 fan VFD target to 80% when ambient WBT > 26 °C.\n2. Verify CH1 condenser approach (currently 2.4 °C — on high side).\n3. Tune CH2 minimum on-time to suppress cycling.`,
        done: true,
      });
    }, 3400);
  }

  return (
    <PageShell>
      <PageHeader
        title="AI Agents"
        subtitle={<>Autonomous HVAC intelligence — 5 specialist agents powered by <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>qwen2.5:14b</span></>}
        icon={<PageHeaderIcon name="bot" gradient={`linear-gradient(135deg, ${mode.c}, ${mode.cDeep})`} />}
      />

      {/* Mode cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 22 }}>
        {MODES.map(m => (
          <ModeCard key={m.id} mode={m} selected={activeId === m.id} onClick={() => { setActiveId(m.id); setGoal(''); setRun(null); }} />
        ))}
      </div>

      {/* Active mode config */}
      <GlassCard padding={20} hover={false}>
        {/* Context */}
        {mode.hasEquipment && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Eyebrow style={{ fontSize: 9, marginBottom: 6, letterSpacing: '0.12em' }}>Equipment (optional)</Eyebrow>
              <Field value={selectedEq} onChange={(e) => setEq(e.target.value)} placeholder="All equipment">
                {equipment.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </Field>
            </div>
            <div>
              <Eyebrow style={{ fontSize: 9, marginBottom: 6, letterSpacing: '0.12em' }}>Window</Eyebrow>
              <Field value={hours} onChange={(e) => setHours(Number(e.target.value))} style={{ width: 130 }}>
                <option value={6}>6 hours</option>
                <option value={12}>12 hours</option>
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
                <option value={168}>7 days</option>
              </Field>
            </div>
          </div>
        )}

        {/* Presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {mode.presets.map((p, i) => <Chip key={i} accentColor={mode.c} onClick={() => setGoal(p)}>{p}</Chip>)}
        </div>

        {/* Goal */}
        <Field
          as="textarea"
          rows={3}
          value={goal}
          onChange={e => setGoal(e.target.value)}
          placeholder={mode.placeholder}
          style={{ background: 'var(--bg-elevated)', marginBottom: 12 }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ctrl+Enter to run</span>
          <Btn
            onClick={handleRun}
            disabled={!goal.trim()}
            style={{ background: mode.c }}
          >Run {mode.label}</Btn>
        </div>
      </GlassCard>

      {/* Trace + output */}
      {run && (
        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
          <div>
            <Eyebrow style={{ fontSize: 9, letterSpacing: '0.12em', marginBottom: 12 }}>Reasoning Trace</Eyebrow>
            <div style={{ position: 'relative', paddingLeft: 22 }}>
              <span style={{
                position: 'absolute', left: 8, top: 14, bottom: 14, width: 2,
                background: 'linear-gradient(180deg, #1F3FFE 0%, #1F3FFE 67%, var(--border-subtle) 67%, var(--border-subtle) 100%)',
                borderRadius: 9999,
              }} />
              {run.trace.map((f, i) => <TraceStep key={i} frame={f} mode={mode} />)}
            </div>
          </div>

          <GlassCard padding={0} hover={false} glow={run.done}>
            <div style={{
              padding: '12px 20px', background: 'var(--bg-elevated)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {run.done
                  ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--status-good)', boxShadow: '0 0 6px rgba(16,185,129,0.6)' }} />
                  : <ThinkingDots />}
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                  {run.done ? 'Investigation complete' : 'Agent is working…'}
                </span>
              </div>
              {run.done && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Pill tone="brand">qwen2.5:14b</Pill>
                  <Pill tone="neutral">3 steps · 3.4s</Pill>
                </div>
              )}
            </div>
            <div style={{ padding: '16px 24px 20px', minHeight: 120 }}>
              {run.output
                ? <MarkdownLite content={run.output} />
                : <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    <ThinkingDots /> <span>Gathering data…</span>
                  </div>
              }
            </div>
          </GlassCard>
        </div>
      )}
    </PageShell>
  );
}

window.AgentsScreen = AgentsScreen;
