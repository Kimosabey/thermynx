/* Placeholder screen for un-built routes */

function PlaceholderScreen({ title, subtitle, iconName, gradient }) {
  return (
    <PageShell>
      <PageHeader
        title={title}
        subtitle={subtitle}
        icon={<PageHeaderIcon name={iconName} gradient={gradient} />}
      />
      <GlassCard hover={false} padding={48} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'rgba(31,63,254,0.07)',
          border: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--brand-300)',
        }}>
          <Icon name={iconName} size={28} stroke={1.5} color="currentColor" />
        </div>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>This view is not part of the UI kit</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', maxWidth: 380, lineHeight: 1.6 }}>
          Visual primitives used here — KPIs, equipment cards, charts, page header — are demonstrated on the Dashboard, Analyzer, Anomalies, and Agents screens.
        </div>
      </GlassCard>
    </PageShell>
  );
}

window.PlaceholderScreen = PlaceholderScreen;
