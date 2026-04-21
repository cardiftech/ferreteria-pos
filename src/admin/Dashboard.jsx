import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, AlertTriangle, TrendingUp, ShoppingBag,
  CreditCard, Banknote, Building2, Package, LogOut,
  Clock, BarChart3,
} from 'lucide-react';

// ── Config ────────────────────────────────────────────────────────────────────
const GAS_URL         = import.meta.env.VITE_GAS_URL;
const ADMIN_PIN       = import.meta.env.VITE_ADMIN_PIN || '1234';
const TIMEZONE        = 'America/Bogota';
const AUTO_REFRESH_MS = 5 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────
function toISOSafe(val) {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function localDateKey(dateStr) {
  if (!dateStr) return '';
  return new Date(toISOSafe(dateStr)).toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

function todayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

function weekAgoKey() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

function fmtCurrency(n) {
  return '$' + Number(n || 0).toLocaleString('es-CO');
}

function fmtTime(dateStr) {
  if (!dateStr) return '';
  return new Date(toISOSafe(dateStr)).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE,
  });
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  return new Date(toISOSafe(dateStr)).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', timeZone: TIMEZONE,
  });
}

// ── API ───────────────────────────────────────────────────────────────────────
async function loadReport() {
  const res  = await fetch(`${GAS_URL}?action=getSalesReport`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

// ── Metrics aggregation ───────────────────────────────────────────────────────
function buildMetrics(sales = [], products = []) {
  const today   = todayKey();
  const weekAgo = weekAgoKey();

  const salesToday = sales.filter(s => localDateKey(s.Fecha) === today);
  const salesWeek  = sales.filter(s => {
    const k = localDateKey(s.Fecha);
    return k >= weekAgo && k <= today;
  });

  const countToday   = salesToday.length;
  const revenueToday = salesToday.reduce((s, v) => s + v.Total, 0);
  const revenueWeek  = salesWeek.reduce((s, v) => s + v.Total, 0);
  const avgTicket    = countToday > 0 ? revenueToday / countToday : 0;

  const payBreakdown = { Efectivo: 0, Tarjeta: 0, Transferencia: 0 };
  salesToday.forEach(s => {
    const m = s.Metodo_Pago || 'Efectivo';
    payBreakdown[m] = (payBreakdown[m] || 0) + s.Total;
  });

  const lowStock = products
    .filter(p => Number(p.Stock_Actual) <= Number(p.Stock_Minimo))
    .map(p => ({
      ...p,
      Stock_Actual: Number(p.Stock_Actual),
      Stock_Minimo: Number(p.Stock_Minimo),
    }))
    .sort((a, b) => a.Stock_Actual - b.Stock_Actual);

  const topMap = {};
  salesToday.forEach(s => {
    try {
      JSON.parse(s.Productos || '[]').forEach(item => {
        const key = item.c || item.Bar_code || item.n;
        if (!topMap[key]) topMap[key] = { name: item.n || item.Descripcion || key, qty: 0, revenue: 0 };
        const q = Number(item.q || item.quantity || 0);
        const p = Number(item.p || item.activePrice || 0);
        topMap[key].qty     += q;
        topMap[key].revenue += q * p;
      });
    } catch (_) {}
  });
  const topProducts = Object.values(topMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const inventoryValue = products.reduce(
    (sum, p) => sum + Number(p.Stock_Actual || 0) * Number(p.Precio_publico_IVA || 0),
    0
  );

  return {
    countToday, revenueToday, revenueWeek, avgTicket,
    payBreakdown, lowStock, topProducts,
    inventoryValue,
    totalProducts: products.length,
    recentSales: sales.slice(0, 25),
  };
}

// ── PIN Gate ──────────────────────────────────────────────────────────────────
function PinGate({ onUnlock }) {
  const [digits, setDigits] = useState('');
  const [shake,  setShake]  = useState(false);

  const press = useCallback((d) => {
    const next = (digits + String(d)).slice(0, 4);
    setDigits(next);
    if (next.length === 4) {
      if (next === ADMIN_PIN) {
        sessionStorage.setItem('admin_ok', '1');
        onUnlock();
      } else {
        setShake(true);
        setTimeout(() => { setShake(false); setDigits(''); }, 600);
      }
    }
  }, [digits, onUnlock]);

  const del = () => setDigits(d => d.slice(0, -1));

  const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, '⌫'];

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-xs space-y-8">

        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-2xl mb-4 shadow-lg">
            <BarChart3 size={32} className="text-white" />
          </div>
          <h1 className="text-white text-xl font-bold">Panel Administrativo</h1>
          <p className="text-slate-400 text-sm mt-1">FerrePOS</p>
        </div>

        <div
          className={`flex justify-center gap-4 ${shake ? 'animate-[shake_0.4s_ease]' : ''}`}
          style={shake ? { animation: 'shake 0.4s ease' } : {}}
        >
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-150
              ${i < digits.length ? 'bg-orange-400 border-orange-400 scale-110' : 'border-slate-500'}`} />
          ))}
        </div>

        {shake && (
          <p className="text-red-400 text-sm text-center -mt-4">PIN incorrecto</p>
        )}

        <div className="grid grid-cols-3 gap-3">
          {KEYS.map((k, i) => {
            if (k === null) return <div key={i} />;
            return (
              <button
                key={i}
                onClick={() => k === '⌫' ? del() : press(k)}
                className={`py-4 rounded-2xl text-lg font-semibold transition-all active:scale-95
                  ${k === '⌫'
                    ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    : 'bg-slate-700 hover:bg-slate-600 active:bg-orange-500 text-white'}`}
              >
                {k}
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-8px); }
          40%      { transform: translateX(8px); }
          60%      { transform: translateX(-5px); }
          80%      { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({ icon: Icon, label, value, sub, color = 'orange', alert = false }) {
  const iconColors = {
    orange: 'bg-orange-50 text-orange-500',
    green:  'bg-green-50  text-green-600',
    blue:   'bg-blue-50   text-blue-600',
    red:    'bg-red-50    text-red-500',
    slate:  'bg-slate-100 text-slate-500',
  };
  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border transition-shadow
      ${alert ? 'border-red-200' : 'border-gray-100'}`}>
      <div className={`inline-flex p-2 rounded-xl mb-3 ${iconColors[color]}`}>
        <Icon size={18} />
      </div>
      <p className="text-xl font-bold text-gray-900 leading-none truncate">{value}</p>
      <p className="text-xs font-medium text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Section title ─────────────────────────────────────────────────────────────
function SectionTitle({ children }) {
  return (
    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-0.5">
      {children}
    </h2>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [authed,   setAuthed]   = useState(() => sessionStorage.getItem('admin_ok') === '1');
  const [metrics,  setMetrics]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [lastSync, setLastSync] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const report = await loadReport();
      setMetrics(buildMetrics(report.sales || [], report.products || []));
      setLastSync(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    load();
    const id = setInterval(load, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [authed, load]);

  if (!authed) return <PinGate onUnlock={() => setAuthed(true)} />;

  const todayLabel = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: TIMEZONE,
  });

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <div className="bg-slate-900 sticky top-0 z-10 px-4 py-3 flex items-center justify-between shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center">
              <BarChart3 size={14} className="text-white" />
            </div>
            <span className="text-white font-bold text-sm">Panel Admin</span>
          </div>
          <p className="text-slate-400 text-xs mt-0.5 capitalize">{todayLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {lastSync && !loading && (
            <span className="text-slate-500 text-xs hidden sm:block">
              {lastSync.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            title="Actualizar datos"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => { sessionStorage.removeItem('admin_ok'); setAuthed(false); }}
            title="Cerrar sesión"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            ⚠ {error} — <button onClick={load} className="underline font-medium">reintentar</button>
          </div>
        )}

        {/* Loading */}
        {loading && !metrics && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Cargando datos…</p>
          </div>
        )}

        {metrics && (
          <>
            {/* ── KPIs del día ── */}
            <div>
              <SectionTitle>Resumen de hoy</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <KPICard
                  icon={ShoppingBag}
                  label="Ventas hoy"
                  value={metrics.countToday}
                  sub={metrics.countToday > 0
                    ? `Prom. ${fmtCurrency(metrics.avgTicket)}`
                    : 'Sin ventas aún'}
                  color="orange"
                />
                <KPICard
                  icon={TrendingUp}
                  label="Ingresos hoy"
                  value={fmtCurrency(metrics.revenueToday)}
                  color="green"
                />
                <KPICard
                  icon={BarChart3}
                  label="Ingresos semana"
                  value={fmtCurrency(metrics.revenueWeek)}
                  sub="Últimos 7 días"
                  color="blue"
                />
                <KPICard
                  icon={AlertTriangle}
                  label="Bajo stock"
                  value={metrics.lowStock.length}
                  sub={metrics.lowStock.length > 0 ? 'Necesitan restock' : 'Todo en orden ✓'}
                  color={metrics.lowStock.length > 0 ? 'red' : 'slate'}
                  alert={metrics.lowStock.length > 0}
                />
              </div>
            </div>

            {/* ── Método de pago hoy ── */}
            <div>
              <SectionTitle>Método de pago — hoy</SectionTitle>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'Efectivo',      label: 'Efectivo',   Icon: Banknote,   cls: 'text-green-600 bg-green-50'   },
                  { key: 'Tarjeta',       label: 'Tarjeta',    Icon: CreditCard, cls: 'text-blue-600 bg-blue-50'     },
                  { key: 'Transferencia', label: 'Transfer.',  Icon: Building2,  cls: 'text-indigo-600 bg-indigo-50' },
                ].map(({ key, label, Icon, cls }) => (
                  <div key={key} className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
                    <div className={`inline-flex p-1.5 rounded-lg mb-2 ${cls}`}>
                      <Icon size={14} />
                    </div>
                    <p className="text-sm font-bold text-gray-900 leading-tight">
                      {fmtCurrency(metrics.payBreakdown[key] || 0)}
                    </p>
                    <p className="text-xs text-gray-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Productos bajo stock ── */}
            {metrics.lowStock.length > 0 && (
              <div>
                <SectionTitle>⚠️ Productos que necesitan restock ({metrics.lowStock.length})</SectionTitle>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {metrics.lowStock.map((p, i) => {
                    const outOfStock = p.Stock_Actual <= 0;
                    return (
                      <div
                        key={p.Bar_code || p.Descripcion}
                        className={`flex items-center px-4 py-3 gap-3
                          ${i < metrics.lowStock.length - 1 ? 'border-b border-gray-50' : ''}
                          ${outOfStock ? 'bg-red-50' : ''}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                          ${outOfStock ? 'bg-red-100' : 'bg-orange-50'}`}>
                          <Package size={14} className={outOfStock ? 'text-red-500' : 'text-orange-500'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.Descripcion}</p>
                          <p className="text-xs text-gray-400">{p.Marca}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold ${outOfStock ? 'text-red-600' : 'text-orange-600'}`}>
                            {p.Stock_Actual}
                          </p>
                          <p className="text-xs text-gray-400">mín {p.Stock_Minimo}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Top productos hoy ── */}
            {metrics.topProducts.length > 0 && (
              <div>
                <SectionTitle>🏆 Más vendidos hoy</SectionTitle>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {metrics.topProducts.map((p, i) => (
                    <div key={p.name}
                      className={`flex items-center px-4 py-3 gap-3
                        ${i < metrics.topProducts.length - 1 ? 'border-b border-gray-50' : ''}`}>
                      <span className="w-6 text-center text-xs font-bold text-gray-300 flex-shrink-0">{i + 1}</span>
                      <p className="flex-1 text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-gray-900">{p.qty} uds</p>
                        <p className="text-xs text-gray-400">{fmtCurrency(p.revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Últimas ventas ── */}
            <div>
              <SectionTitle>🕐 Últimas ventas</SectionTitle>
              {metrics.recentSales.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center text-gray-400 shadow-sm border border-gray-100">
                  <p className="text-sm">No hay ventas registradas aún</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {metrics.recentSales.map((s, i) => {
                    const isToday = localDateKey(s.Fecha) === todayKey();
                    const methodColor = {
                      Efectivo:      'bg-green-50 text-green-700',
                      Tarjeta:       'bg-blue-50  text-blue-700',
                      Transferencia: 'bg-indigo-50 text-indigo-700',
                    }[s.Metodo_Pago] || 'bg-gray-100 text-gray-600';

                    return (
                      <div key={s.ID_Venta}
                        className={`flex items-center px-4 py-3 gap-3
                          ${i < metrics.recentSales.length - 1 ? 'border-b border-gray-50' : ''}`}>
                        <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Clock size={14} className="text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-gray-700">
                              {isToday ? fmtTime(s.Fecha) : fmtDate(s.Fecha)}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${methodColor}`}>
                              {s.Metodo_Pago || 'Efectivo'}
                            </span>
                          </div>
                          {s.Cliente && (
                            <p className="text-xs text-gray-400 truncate mt-0.5">{s.Cliente}</p>
                          )}
                        </div>
                        <p className="text-sm font-bold text-gray-900 flex-shrink-0">
                          {fmtCurrency(s.Total)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Resumen de inventario ── */}
            <div className="bg-slate-800 rounded-2xl px-5 py-4 shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <Package size={16} className="text-orange-400" />
                <span className="text-white text-sm font-semibold">Inventario total</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold text-white">{metrics.totalProducts}</p>
                  <p className="text-slate-400 text-xs">productos en catálogo</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-orange-400 leading-tight">
                    {fmtCurrency(metrics.inventoryValue)}
                  </p>
                  <p className="text-slate-400 text-xs">valor en stock</p>
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-gray-300 pb-4">
              Última actualización: {lastSync?.toLocaleTimeString('es-CO')}
              {' · '}Auto-refresh cada 5 min
            </p>
          </>
        )}
      </div>
    </div>
  );
}
