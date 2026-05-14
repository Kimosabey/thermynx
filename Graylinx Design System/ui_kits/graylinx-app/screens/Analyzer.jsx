/* AI Analyzer — equipment + thread + chart + chat */

const QUICK_PROMPTS = [
  'Analyze chiller efficiency and identify performance issues',
  'Why is kW/TR outside optimal range?',
  'Compare Chiller 1 vs Chiller 2 performance',
  'Are there any anomalies or alerts right now?',
  'Maintenance recommendations based on current data',
  'Summarize energy consumption and cooling output',
];

const FAKE_RESPONSE = `## Chiller 1 efficiency analysis

Over the last 24 hours, **Chiller 1 averaged 0.612 kW/TR** — comfortably inside the good band (< 0.65). However, two windows stand out:

### Notable patterns

- Between **02:30–04:00 IST**, kW/TR drifted up to **0.71**, coinciding with a 1.4 °C rise in condenser inlet water temperature. The cooling tower fan was at 65% — bumping to 85% would have recovered ~0.04 kW/TR.
- Load was steady at **62.4%**, well above the 30% minimum-staging threshold, so part-load inefficiency is not the issue.

### Top 3 actions

1. **Raise CT-1 fan VFD target** from 65% to 80% during night hours when ambient WBT exceeds 26 °C.
2. **Verify chiller approach** — current approach is 2.4 °C, on the high side; schedule a condenser tube cleaning if no improvement in 48h.
3. **Investigate CH2 cycling** — it short-cycled 4× overnight, dropping average efficiency by 0.03 kW/TR.

> Confidence: **high** · Data points: **1,440** · Window: **24h**`;

function ChartPlaceholder({ equipmentName, hasData }) {
  if (!hasData) {
    return (
      <GlassCard hover={false} style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Select equipment to view chart</span>
      </GlassCard>
    );
  }
  // Static SVG sparkline-ish chart
  const points = [
    [0,55],[25,52],[50,48],[75,45],[100,50],[125,53],[150,49],[175,46],
    [200,44],[225,40],[250,42],[275,46],[300,52],[325,58],[350,55],[375,50],
    [400,48],[425,52],[450,56],[475,60],[500,58],[525,53],[550,49],[575,47],
    [600,45],[625,48],[650,52],[675,55],[700,51],[725,48],[750,45],[775,47],
    [800,50],[825,53],[850,51],[875,49],[900,47],[925,52],[950,55],[975,52],
  ];
  const pathD = 'M' + points.map(([x,y]) => `${x},${y}`).join(' L');
  const areaD = pathD + ` L 975,100 L 0,100 Z`;
  const bars = points.filter((_,i) => i % 2 === 0);
  return (
    <GlassCard padding={0} hover={false}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 12px', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{equipmentName}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Pill tone="good">Avg kW/TR: 0.612</Pill>
          <Pill tone="neutral">15m · 24h · 96 pts</Pill>
        </div>
      </div>
      <div style={{ position: 'relative', height: 160, padding: '4px 16px 8px' }}>
        <svg viewBox="0 0 1000 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
          <defs>
            <linearGradient id="ts-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#1F3FFE" stopOpacity="0.15" />
              <stop offset="95%" stopColor="#1F3FFE" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* grid */}
          {[20, 40, 60, 80].map(y => (
            <line key={y} x1="0" y1={y} x2="1000" y2={y} stroke="rgba(31,63,254,0.06)" strokeWidth="1" strokeDasharray="3 3" />
          ))}
          {/* good/poor reference lines */}
          <line x1="0" y1="35" x2="1000" y2="35" stroke="#10b981" strokeDasharray="5 3" strokeOpacity="0.35" strokeWidth="1.5" />
          <line x1="0" y1="65" x2="1000" y2="65" stroke="#ef4444" strokeDasharray="5 3" strokeOpacity="0.35" strokeWidth="1.5" />
          {/* bars */}
          {bars.map(([x, y], i) => (
            <rect key={i} x={x - 2} y={75} width="3" height={25 - (y / 4)} fill="rgba(31,63,254,0.08)" rx="1.5" />
          ))}
          {/* area */}
          <path d={areaD} fill="url(#ts-grad)" />
          {/* line */}
          <path d={pathD} fill="none" stroke="#1F3FFE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </GlassCard>
  );
}

function MarkdownLite({ content }) {
  // Minimal markdown: ## / ### / **bold** / - list / > blockquote / `code`
  const lines = content.split('\n');
  const out = [];
  let listBuffer = [];
  const flushList = () => {
    if (listBuffer.length) {
      out.push(
        <ul key={`l${out.length}`} style={{ paddingLeft: 20, marginBottom: 14 }}>
          {listBuffer.map((t, i) => (
            <li key={i} style={{ marginBottom: 6, color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.7 }}>{renderInline(t)}</li>
          ))}
        </ul>
      );
      listBuffer = [];
    }
  };
  const renderInline = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((p, i) => {
      if (p.startsWith('**')) return <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{p.slice(2, -2)}</strong>;
      if (p.startsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>;
      return p;
    });
  };
  lines.forEach((line, idx) => {
    if (line.startsWith('## ')) {
      flushList();
      out.push(<h2 key={idx} style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 20, marginBottom: 10, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>{line.slice(3)}</h2>);
    } else if (line.startsWith('### ')) {
      flushList();
      out.push(<h3 key={idx} style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-primary)', marginTop: 16, marginBottom: 8 }}>{line.slice(4)}</h3>);
    } else if (line.startsWith('- ')) {
      listBuffer.push(line.slice(2));
    } else if (line.startsWith('> ')) {
      flushList();
      out.push(<blockquote key={idx} style={{ borderLeft: '2px solid #1F3FFE', paddingLeft: 14, margin: '14px 0', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13, lineHeight: 1.7 }}>{renderInline(line.slice(2))}</blockquote>);
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      out.push(<p key={idx} style={{ marginBottom: 12, lineHeight: 1.8, color: 'var(--text-primary)', fontSize: 13 }}>{renderInline(line)}</p>);
    }
  });
  flushList();
  return <div style={{ fontFamily: 'inherit' }}>{out}</div>;
}

function AnalyzerScreen({ equipment, threads }) {
  const [selectedEq, setSelectedEq] = React.useState('chiller_1');
  const [hours, setHours]           = React.useState(24);
  const [thread, setThread]         = React.useState('');
  const [question, setQuestion]     = React.useState('');
  const [state, setState]           = React.useState('idle'); // idle | streaming | done
  const [content, setContent]       = React.useState('');
  const streamRef = React.useRef(null);

  const eqObj = equipment.find(e => e.id === selectedEq);

  function startAnalyze() {
    if (!question.trim()) return;
    if (streamRef.current) clearInterval(streamRef.current);
    setState('streaming');
    setContent('');
    let i = 0;
    streamRef.current = setInterval(() => {
      i += 20;
      if (i >= FAKE_RESPONSE.length) {
        setContent(FAKE_RESPONSE);
        setState('done');
        clearInterval(streamRef.current);
        return;
      }
      setContent(FAKE_RESPONSE.slice(0, i));
    }, 40);
  }

  function stop() {
    if (streamRef.current) clearInterval(streamRef.current);
    setState(content ? 'done' : 'idle');
  }

  React.useEffect(() => () => streamRef.current && clearInterval(streamRef.current), []);

  return (
    <PageShell maxWidth={1100}>
      <PageHeader
        title="AI Analyzer"
        subtitle="Ask anything about your HVAC plant — powered by local AI"
        icon={<div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: 'linear-gradient(135deg, #1F3FFE, #000F64)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(31,63,254,0.25)',
        }}>
          <Icon name="message-square-text" size={20} stroke={1.85} color="#FFF" />
        </div>}
      />

      {/* Selectors */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <Eyebrow style={{ marginBottom: 8 }}>Equipment</Eyebrow>
          <Field value={selectedEq} onChange={(e) => setSelectedEq(e.target.value)} placeholder="All equipment">
            <optgroup label="Chillers">
              <option value="chiller_1">Chiller 1</option>
              <option value="chiller_2">Chiller 2</option>
            </optgroup>
            <optgroup label="Cooling Towers">
              <option value="cooling_tower_1">Cooling Tower 1</option>
              <option value="cooling_tower_2">Cooling Tower 2</option>
            </optgroup>
            <optgroup label="Pumps">
              <option value="condenser_pump_1">Condenser Pump 1-2</option>
              <option value="condenser_pump_3">Condenser Pump 3</option>
            </optgroup>
          </Field>
        </div>
        <div>
          <Eyebrow style={{ marginBottom: 8 }}>Time window</Eyebrow>
          <Field value={hours} onChange={(e) => setHours(Number(e.target.value))} style={{ width: 140 }}>
            <option value={6}>Last 6 hours</option>
            <option value={12}>Last 12 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={48}>Last 48 hours</option>
            <option value={168}>Last 7 days</option>
          </Field>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <Eyebrow style={{ marginBottom: 8 }}>Conversation thread</Eyebrow>
          <div style={{ display: 'flex', gap: 8 }}>
            <Field value={thread} onChange={(e) => setThread(e.target.value)} placeholder="Memory off">
              {threads.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </Field>
            <Btn variant="outline" size="xs" onClick={() => alert('New thread (mock)')}>New thread</Btn>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <ChartPlaceholder equipmentName={eqObj?.name || 'Chiller 1'} hasData={!!selectedEq} />
      </div>

      {/* Quick prompts */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {QUICK_PROMPTS.map((p, i) => (
          <Chip key={i} onClick={() => setQuestion(p)}>{p}</Chip>
        ))}
      </div>

      {/* Composer */}
      <GlassCard padding={16} hover={false} style={{ marginBottom: 16 }}>
        <Field
          as="textarea"
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about chiller efficiency, energy consumption, anomalies, maintenance…"
          style={{ border: 'none', background: 'transparent', padding: 0, boxShadow: 'none' }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) startAnalyze(); }}
        />
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ctrl+Enter to send</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {state === 'streaming' && <Btn variant="danger" size="xs" onClick={stop}>Stop</Btn>}
            <Btn onClick={startAnalyze} disabled={state === 'streaming' || !question.trim()}>
              {state === 'streaming' ? 'Analyzing…' : 'Analyze'}
            </Btn>
          </div>
        </div>
      </GlassCard>

      {/* Response */}
      {(state !== 'idle' || content) && (
        <GlassCard padding={0} hover={false} glow={state === 'done'}>
          <div style={{
            padding: '12px 20px', background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {state === 'streaming'
                ? <ThinkingDots />
                : <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--status-good)', boxShadow: '0 0 6px rgba(16,185,129,0.6)' }} />}
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                {state === 'streaming' ? 'Generating analysis…' : 'Analysis complete'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Pill tone="brand">qwen2.5:14b</Pill>
              <Pill tone="neutral">{state === 'done' ? '3.4s' : '—'}</Pill>
            </div>
          </div>
          {/* mini stats */}
          {selectedEq.startsWith('chiller') && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              {[
                { l: `${eqObj?.name} kW/TR`, v: '0.612', color: 'var(--status-good)' },
                { l: 'Avg Load',    v: '62.4%' },
                { l: 'Data points', v: '96' },
                { l: 'Window',      v: `${hours}h` },
              ].map((item, i) => (
                <div key={i} style={{
                  padding: '12px 16px',
                  borderRight: i < 3 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  <Eyebrow style={{ fontSize: 9, marginBottom: 4 }}>{item.l}</Eyebrow>
                  <div style={{
                    fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                    color: item.color || 'var(--text-primary)',
                  }}>{item.v}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ padding: '16px 24px 20px' }}>
            {content ? <MarkdownLite content={content} /> : <ThinkingDots />}
          </div>
        </GlassCard>
      )}
    </PageShell>
  );
}

window.AnalyzerScreen = AnalyzerScreen;
