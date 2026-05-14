/* Print App — render all 4 main screens stacked, one per page */

function PrintApp() {
  // Force light mode for print
  React.useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  const screens = [
    { title: 'Dashboard',         el: <DashboardScreen data={MOCK_SUMMARY} /> },
    { title: 'AI Analyzer',       el: <AnalyzerScreen equipment={MOCK_EQUIPMENT} threads={MOCK_THREADS} /> },
    { title: 'Anomaly Detector',  el: <AnomaliesScreen anomalies={MOCK_ANOMALIES} /> },
    { title: 'AI Agents',         el: <AgentsScreen equipment={MOCK_EQUIPMENT} /> },
  ];

  return (
    <>
      {screens.map((s, i) => (
        <section
          key={i}
          className="print-page"
          data-screen-label={`Graylinx · ${s.title}`}
        >
          <header className="print-header">
            <div className="print-brand">
              <span className="print-mark"><img src="../../assets/logo.png" alt="" /></span>
              <span>
                <span className="print-brand-name">Graylinx</span>
                <span className="print-brand-sub">HVAC intelligence · {s.title}</span>
              </span>
            </div>
            <div className="print-pagenum">{String(i + 1).padStart(2, '0')} / {String(screens.length).padStart(2, '0')}</div>
          </header>
          <div className="print-body">{s.el}</div>
        </section>
      ))}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<PrintApp />);

// Auto-print after everything is ready
(function autoPrint() {
  const ready = () => {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => setTimeout(() => window.print(), 600));
    } else {
      setTimeout(() => window.print(), 1200);
    }
  };
  if (document.readyState === 'complete') ready();
  else window.addEventListener('load', ready);
})();
