/* Operations Dashboard — KPI strip + equipment grid */

const EQUIPMENT_TYPES = { chiller: 'snowflake', cooling_tower: 'fan', pump: 'waves' };

function effAccent(v) {
  if (v == null) return 'var(--accent-primary)';
  if (v < 0.65) return 'var(--status-good)';
  if (v < 0.85) return 'var(--status-warn)';
  return 'var(--status-bad)';
}

function EquipCard({ name, type, data }) {
  const running = data?.running_pct;
  const isOn = running != null && running > 0;
  const kwTr = data?.avg_kw_per_tr;
  const accent = effAccent(kwTr);
  return (
    <GlassCard padding={18}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <StatusDot active={isOn} />
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'rgba(31,63,254,0.05)',
            border: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isOn ? 'var(--brand-300)' : 'var(--text-muted)', flexShrink: 0,
          }}>
            <Icon name={EQUIPMENT_TYPES[type] || 'waves'} size={16} stroke={1.75} />
          </div>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{name}</span>
        </div>
        <Pill tone={isOn ? 'good' : 'muted'}>{isOn ? 'RUNNING' : 'STANDBY'}</Pill>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <Eyebrow style={{ marginBottom: 4, fontSize: 9 }}>Avg kW</Eyebrow>
          <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
            {data?.avg_kw != null ? Number(data.avg_kw).toFixed(1) : '—'}
          </div>
        </div>
        <div>
          <Eyebrow style={{ marginBottom: 4, fontSize: 9 }}>Run %</Eyebrow>
          <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
            {running != null ? `${running}%` : '—'}
          </div>
        </div>
        {type === 'chiller' && (
          <>
            <div>
              <Eyebrow style={{ marginBottom: 4, fontSize: 9 }}>kW/TR</Eyebrow>
              <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: accent }}>
                {kwTr != null ? kwTr.toFixed(3) : '—'}
              </div>
            </div>
            <div>
              <Eyebrow style={{ marginBottom: 4, fontSize: 9 }}>Load</Eyebrow>
              <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                {data?.avg_chiller_load != null ? `${Number(data.avg_chiller_load).toFixed(1)}%` : '—'}
              </div>
            </div>
          </>
        )}
      </div>
    </GlassCard>
  );
}

function HealthChip({ icon, ok, label, title }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
      borderRadius: 10, padding: '8px 12px', color: 'var(--text-muted)',
    }}>
      <span style={{ opacity: 0.55, display: 'flex' }}>
        <Icon name={icon} size={14} stroke={2} color="currentColor" />
      </span>
      <StatusDot active={ok} size={7} />
      <span title={title} style={{
        fontSize: 11, color: ok ? 'var(--status-good)' : 'var(--status-bad)', fontWeight: 500,
        maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{label}</span>
    </div>
  );
}

function DashboardScreen({ data }) {
  const [refreshing, setRefreshing] = React.useState(false);
  const s = data.summary;
  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };
  return (
    <PageShell>
      <PageHeader
        title="Operations Dashboard"
        subtitle="Unicharm HVAC Plant · Last 24 hours"
        actions={
          <>
            <HealthChip icon="database" ok={true} label="DB" />
            <HealthChip icon="cpu" ok={true} label="qwen2.5:14b" title="qwen2.5:14b" />
            <IconBtn ariaLabel="Refresh dashboard" onClick={refresh}>
              <div style={{
                display: 'flex',
                transition: 'transform 0.55s ease',
                transform: refreshing ? 'rotate(360deg)' : 'rotate(0deg)',
              }}>
                <Icon name="refresh-cw" size={16} stroke={2} color="currentColor" />
              </div>
            </IconBtn>
          </>
        }
      />

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
        Historical snapshot: window ends{' '}
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>2026-05-14 14:30:00</span>
        {' '}UTC (2026-05-13 14:30:00 → 2026-05-14 14:30:00).
      </div>

      {/* KPI strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
        gap: 14, marginBottom: 24,
      }}>
        <KpiCard label="Chiller 1 kW/TR" value={s.chiller_1?.avg_kw_per_tr} decimals={3} accent={effAccent(s.chiller_1?.avg_kw_per_tr)} helpText="Efficiency" iconName="snowflake" />
        <KpiCard label="Chiller 2 kW/TR" value={s.chiller_2?.avg_kw_per_tr} decimals={3} accent={effAccent(s.chiller_2?.avg_kw_per_tr)} helpText="Efficiency" iconName="snowflake" />
        <KpiCard label="CH1 Load" value={s.chiller_1?.avg_chiller_load} unit="%" decimals={1} iconName="gauge" />
        <KpiCard label="CH2 Load" value={s.chiller_2?.avg_chiller_load} unit="%" decimals={1} iconName="gauge" />
        <KpiCard label="Ambient" value={s.chiller_1?.latest_ambient_temp} unit="°C" decimals={1} iconName="thermometer-sun" />
        <KpiCard label="CHW Supply" value={s.chiller_1?.latest_evap_leaving} unit="°C" decimals={1} iconName="droplets" />
      </div>

      <Eyebrow style={{ marginBottom: 14 }}>Equipment Overview</Eyebrow>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 16,
      }}>
        <EquipCard name="Chiller 1"          data={s.chiller_1}        type="chiller" />
        <EquipCard name="Chiller 2"          data={s.chiller_2}        type="chiller" />
        <EquipCard name="Cooling Tower 1"    data={s.cooling_tower_1}  type="cooling_tower" />
        <EquipCard name="Cooling Tower 2"    data={s.cooling_tower_2}  type="cooling_tower" />
        <EquipCard name="Condenser Pump 1-2" data={s.condenser_pump_1} type="pump" />
        <EquipCard name="Condenser Pump 3"   data={s.condenser_pump_3} type="pump" />
      </div>
    </PageShell>
  );
}

window.DashboardScreen = DashboardScreen;
