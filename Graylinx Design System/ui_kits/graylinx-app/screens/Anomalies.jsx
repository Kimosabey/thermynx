/* Anomaly Detector — summary chips + critical/warning anomaly cards */

const SEVERITY = {
  critical: { color: 'var(--status-bad)', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)', label: 'CRITICAL' },
  warning:  { color: 'var(--status-warn)', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', label: 'WARNING' },
};

function ZScorePill({ z }) {
  const abs = Math.abs(z);
  const color = abs >= 4.5 ? 'var(--status-bad)' : abs >= 3.5 ? '#f97316' : 'var(--status-warn)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: `${color}1F`,
      border: `1px solid ${color}66`,
      borderRadius: 9999, padding: '2px 10px',
      fontSize: 11, fontWeight: 700, color,
      fontVariantNumeric: 'tabular-nums',
    }}>{z > 0 ? '+' : ''}{z.toFixed(1)}σ</span>
  );
}

function AnomalyCard({ a }) {
  const meta = SEVERITY[a.severity] || SEVERITY.warning;
  const time = new Date(a.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return (
    <GlassCard padding={18}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
            {(a.equipment_name || a.equipment_id).replace(/_/g, ' ')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {a.metric.replace(/_/g, ' ')} · {time}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ZScorePill z={a.z_score} />
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 9999,
            background: meta.bg, color: meta.color,
            border: `1px solid ${meta.border}`, letterSpacing: '0.04em',
          }}>{meta.label}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 22, marginBottom: 12 }}>
        <div>
          <Eyebrow style={{ fontSize: 9, marginBottom: 4 }}>Value</Eyebrow>
          <div style={{ fontSize: 18, fontWeight: 700, color: meta.color, fontVariantNumeric: 'tabular-nums' }}>
            {a.value?.toFixed(3) ?? '—'}
          </div>
        </div>
        <div>
          <Eyebrow style={{ fontSize: 9, marginBottom: 4 }}>Baseline</Eyebrow>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {a.baseline_mean?.toFixed(3) ?? '—'}
          </div>
        </div>
        <div>
          <Eyebrow style={{ fontSize: 9, marginBottom: 4 }}>Std Dev</Eyebrow>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            ±{a.baseline_std?.toFixed(3) ?? '—'}
          </div>
        </div>
      </div>
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
        borderRadius: 8, padding: '8px 12px',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{a.description}</span>
      </div>
    </GlassCard>
  );
}

function EmptyState() {
  return (
    <GlassCard hover={false} padding={48} style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      <div style={{
        width: 56, height: 56, borderRadius: 9999,
        background: 'rgba(5,150,105,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--status-good)',
      }}>
        <Icon name="check-circle-2" size={32} stroke={1.5} color="#10b981" />
      </div>
      <div style={{ fontWeight: 600, color: 'var(--status-good)', fontSize: 14 }}>No anomalies detected</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', maxWidth: 320 }}>
        All equipment is operating within normal statistical range
      </div>
    </GlassCard>
  );
}

function AnomaliesScreen({ anomalies: seed }) {
  const [hours, setHours]   = React.useState(1);
  const [anomalies, setAnomalies] = React.useState(seed);
  const [scanning, setScanning] = React.useState(false);

  const scan = () => {
    setScanning(true);
    setTimeout(() => {
      // mock: add a new one occasionally
      if (Math.random() > 0.5) {
        setAnomalies(a => [
          {
            equipment_id: 'chiller_2',
            equipment_name: 'Chiller 2',
            metric: 'condenser_approach',
            severity: 'warning',
            timestamp: new Date().toISOString(),
            z_score: 3.7,
            value: 0.82,
            baseline_mean: 0.61,
            baseline_std: 0.057,
            description: 'Condenser approach temperature drifting upward — possible fouling on CH2 condenser bundle.',
          },
          ...a,
        ]);
      }
      setScanning(false);
    }, 800);
  };

  const critical = anomalies.filter(a => a.severity === 'critical').length;
  const warning  = anomalies.filter(a => a.severity === 'warning').length;
  const lastScan = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <PageShell>
      <PageHeader
        title="Anomaly Detector"
        subtitle={`Statistical z-score detection · auto-scan every 5 min · last scanned ${lastScan}`}
        icon={<PageHeaderIcon name="triangle-alert" gradient="linear-gradient(135deg, #f97316, #ef4444)" />}
        actions={
          <>
            <Field value={hours} onChange={e => setHours(Number(e.target.value))} style={{ width: 130 }}>
              <option value={1}>Last 1 hour</option>
              <option value={3}>Last 3 hours</option>
              <option value={6}>Last 6 hours</option>
              <option value={12}>Last 12 hours</option>
              <option value={24}>Last 24 hours</option>
            </Field>
            <Btn variant="outline" size="xs" onClick={scan}>{scanning ? 'Scanning…' : 'Scan now'}</Btn>
          </>
        }
      />

      <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
        {[
          { label: 'Critical', count: critical, color: 'var(--status-bad)', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
          { label: 'Warning',  count: warning,  color: 'var(--status-warn)', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
          { label: 'Total',    count: anomalies.length, color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.15)' },
        ].map(s => (
          <div key={s.label} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: s.bg, border: `1px solid ${s.border}`,
            borderRadius: 10, padding: '8px 14px',
          }}>
            <span style={{ fontSize: 13, color: s.color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.count}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {anomalies.length === 0
        ? <EmptyState />
        : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {anomalies.map((a, i) => <AnomalyCard key={`${a.equipment_id}-${a.metric}-${i}`} a={a} />)}
          </div>
        )
      }
    </PageShell>
  );
}

window.AnomaliesScreen = AnomaliesScreen;
