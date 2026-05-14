/* App — top-level route + theme state */

function useTheme() {
  const [theme, setTheme] = React.useState(() => {
    try { return localStorage.getItem('graylinx-theme') || 'light'; }
    catch { return 'light'; }
  });
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('graylinx-theme', theme); } catch {}
  }, [theme]);
  return [theme, setTheme];
}

function App() {
  const [route, setRoute]         = React.useState('dashboard');
  const [collapsed, setCollapsed] = React.useState(false);
  const [theme, setTheme]         = useTheme();

  let screen;
  switch (route) {
    case 'dashboard': screen = <DashboardScreen data={MOCK_SUMMARY} />; break;
    case 'analyzer':  screen = <AnalyzerScreen equipment={MOCK_EQUIPMENT} threads={MOCK_THREADS} />; break;
    case 'anomalies': screen = <AnomaliesScreen anomalies={MOCK_ANOMALIES} />; break;
    case 'agent':     screen = <AgentsScreen equipment={MOCK_EQUIPMENT} />; break;
    case 'efficiency':  screen = <PlaceholderScreen title="Efficiency"  subtitle="Plant-wide kW/TR trends" iconName="zap" gradient="linear-gradient(135deg, #10b981, #047857)" />; break;
    case 'forecast':    screen = <PlaceholderScreen title="Forecast"    subtitle="48-hour load forecast"   iconName="trending-up" gradient="linear-gradient(135deg, #1F3FFE, #000F64)" />; break;
    case 'compare':     screen = <PlaceholderScreen title="Compare"     subtitle="Side-by-side equipment comparison" iconName="columns-2" gradient="linear-gradient(135deg, #1F3FFE, #000F64)" />; break;
    case 'maintenance': screen = <PlaceholderScreen title="Maintenance" subtitle="Health scorecards and service log" iconName="wrench" gradient="linear-gradient(135deg, #f97316, #c2410c)" />; break;
    case 'cost':        screen = <PlaceholderScreen title="Cost Analytics" subtitle="Energy cost breakdown · INR" iconName="indian-rupee" gradient="linear-gradient(135deg, #10b981, #047857)" />; break;
    case 'reports':     screen = <PlaceholderScreen title="Reports"     subtitle="Generate, export, and share" iconName="file-text" gradient="linear-gradient(135deg, #1F3FFE, #000F64)" />; break;
    case 'rag':         screen = <PlaceholderScreen title="Knowledge"   subtitle="Manuals · SOPs · vendor docs" iconName="book-open" gradient="linear-gradient(135deg, #7c3aed, #5b21b6)" />; break;
    default:            screen = <DashboardScreen data={MOCK_SUMMARY} />;
  }

  return (
    <div data-screen-label={`Graylinx · ${route} · ${theme}`} className="app-shell">
      <Sidebar
        activeRoute={route}
        onNavigate={setRoute}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        theme={theme}
        onToggleTheme={setTheme}
      />
      <main className="app-main" key={route}>
        {screen}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
