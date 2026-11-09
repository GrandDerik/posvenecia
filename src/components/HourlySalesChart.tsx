import React, { useState, useMemo } from 'react';
import { Sale } from '../types';
import { formatBs, formatUSD } from '../utils/exportUtils';
import { TrendingUp, Clock, Zap, DollarSign, ArrowUpRight } from 'lucide-react';

interface HourlySalesChartProps {
  sales: Sale[];
  bcvRate: number;
}

export const HourlySalesChart: React.FC<HourlySalesChartProps> = ({ sales, bcvRate }) => {
  const [currency, setCurrency] = useState<'USD' | 'Bs'>('USD');
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  // Filter today's sales
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const todaySales = useMemo(() => {
    return sales.filter((s) => s.status === 'completada' && s.date.startsWith(todayStr));
  }, [sales, todayStr]);

  // Aggregate by hour (0 to 23, but display active business hours 07:00 to 22:00 or active hours)
  const hourlyData = useMemo(() => {
    const hoursMap: { [hour: number]: { totalUSD: number; totalBs: number; count: number } } = {};
    for (let h = 7; h <= 21; h++) {
      hoursMap[h] = { totalUSD: 0, totalBs: 0, count: 0 };
    }

    todaySales.forEach((s) => {
      const saleDate = new Date(s.date);
      const hour = saleDate.getHours();
      if (!hoursMap[hour]) {
        hoursMap[hour] = { totalUSD: 0, totalBs: 0, count: 0 };
      }
      hoursMap[hour].totalUSD += s.totalUSD;
      hoursMap[hour].totalBs += s.totalBs;
      hoursMap[hour].count += 1;
    });

    return Object.keys(hoursMap)
      .map((h) => Number(h))
      .sort((a, b) => a - b)
      .map((hour) => ({
        hour,
        label: `${hour.toString().padStart(2, '0')}:00`,
        totalUSD: hoursMap[hour].totalUSD,
        totalBs: hoursMap[hour].totalBs,
        count: hoursMap[hour].count,
      }));
  }, [todaySales]);

  const maxVal = useMemo(() => {
    const vals = hourlyData.map((d) => (currency === 'USD' ? d.totalUSD : d.totalBs));
    return Math.max(...vals, currency === 'USD' ? 50 : 2000);
  }, [hourlyData, currency]);

  // Peak Hour
  const peakHour = useMemo(() => {
    let peak = hourlyData[0];
    hourlyData.forEach((d) => {
      const val = currency === 'USD' ? d.totalUSD : d.totalBs;
      const peakVal = currency === 'USD' ? peak.totalUSD : peak.totalBs;
      if (val > peakVal) {
        peak = d;
      }
    });
    return peak && (currency === 'USD' ? peak.totalUSD : peak.totalBs) > 0 ? peak : null;
  }, [hourlyData, currency]);

  const totalDayUSD = useMemo(() => todaySales.reduce((a, s) => a + s.totalUSD, 0), [todaySales]);
  const totalDayBs = useMemo(() => todaySales.reduce((a, s) => a + s.totalBs, 0), [todaySales]);
  const avgTicketUSD = todaySales.length > 0 ? totalDayUSD / todaySales.length : 0;
  const avgTicketBs = todaySales.length > 0 ? totalDayBs / todaySales.length : 0;

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-5">
      {/* Header and Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 tracking-tight">
                Curva de Ventas del Día
              </h3>
              <p className="text-xs text-slate-500">
                Distribución y flujo de ingresos por hora en la jornada de hoy
              </p>
            </div>
          </div>
        </div>

        {/* Currency Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto border border-slate-200/60">
          <button
            type="button"
            onClick={() => setCurrency('USD')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              currency === 'USD'
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Dólares ($ USD)
          </button>
          <button
            type="button"
            onClick={() => setCurrency('Bs')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              currency === 'Bs'
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bolívares (Bs.)
          </button>
        </div>
      </div>

      {/* Metric Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3">
          <div className="text-[11px] font-bold text-slate-500">Total Facturado Hoy</div>
          <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
            {currency === 'USD' ? `$${formatUSD(totalDayUSD)}` : `Bs. ${formatBs(totalDayBs)}`}
          </div>
          <div className="text-[10px] text-slate-400">
            {todaySales.length} transacciones
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3">
          <div className="text-[11px] font-bold text-slate-500">Ticket Promedio</div>
          <div className="text-lg font-black text-indigo-600 font-mono mt-0.5">
            {currency === 'USD' ? `$${formatUSD(avgTicketUSD)}` : `Bs. ${formatBs(avgTicketBs)}`}
          </div>
          <div className="text-[10px] text-slate-400">Por venta registrada</div>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3">
          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Hora Pico
          </div>
          <div className="text-lg font-black text-amber-600 font-mono mt-0.5">
            {peakHour ? peakHour.label : 'Sin ventas'}
          </div>
          <div className="text-[10px] text-slate-400">
            {peakHour ? `${peakHour.count} compras` : 'A la espera'}
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3">
          <div className="text-[11px] font-bold text-slate-500">Tasa Oficial BCV</div>
          <div className="text-lg font-black text-emerald-600 font-mono mt-0.5">
            Bs. {formatBs(bcvRate)}
          </div>
          <div className="text-[10px] text-slate-400">Por cada 1.00 USD</div>
        </div>
      </div>

      {/* SVG Bar Chart with Hover Details */}
      <div className="relative pt-4">
        {todaySales.length === 0 ? (
          <div className="h-48 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <Clock className="w-8 h-8 text-slate-300 mb-2 stroke-[1.5]" />
            <p className="text-xs font-semibold">No se han registrado ventas en la jornada de hoy aún</p>
            <p className="text-[11px] text-slate-400 mt-1">A medida que realices cobros en caja, la gráfica se actualizará en tiempo real</p>
          </div>
        ) : (
          <div>
            <div className="h-56 flex items-end gap-1.5 sm:gap-2.5 px-2 pb-6 border-b border-slate-200">
              {hourlyData.map((d) => {
                const val = currency === 'USD' ? d.totalUSD : d.totalBs;
                const heightPercent = maxVal > 0 ? Math.min(100, Math.max(val > 0 ? 8 : 2, (val / maxVal) * 100)) : 2;
                const isHovered = hoveredHour === d.hour;
                const isPeak = peakHour && peakHour.hour === d.hour && val > 0;

                return (
                  <div
                    key={d.hour}
                    className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                    onMouseEnter={() => setHoveredHour(d.hour)}
                    onMouseLeave={() => setHoveredHour(null)}
                  >
                    {/* Tooltip on Hover */}
                    {isHovered && (
                      <div className="absolute -top-12 z-20 bg-slate-900 text-white text-[10px] font-mono py-1 px-2.5 rounded-lg shadow-xl pointer-events-none whitespace-nowrap animate-in fade-in duration-150">
                        <div className="font-bold text-indigo-300">{d.label}</div>
                        <div>{currency === 'USD' ? `$${formatUSD(d.totalUSD)}` : `Bs. ${formatBs(d.totalBs)}`}</div>
                        <div className="text-slate-400 text-[9px]">{d.count} ventas</div>
                      </div>
                    )}

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-lg transition-all duration-300 ${
                        isPeak
                          ? 'bg-gradient-to-t from-amber-500 to-orange-400 shadow-xs'
                          : val > 0
                          ? isHovered
                            ? 'bg-indigo-600'
                            : 'bg-indigo-400 hover:bg-indigo-500'
                          : 'bg-slate-100 hover:bg-slate-200'
                      }`}
                    />

                    {/* Hour Label */}
                    <span className="absolute -bottom-5 text-[9px] font-bold text-slate-400 group-hover:text-indigo-600 font-mono">
                      {d.hour}h
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-3 px-1">
              <span>07:00 AM (Inicio jornada)</span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-amber-500 to-orange-400 inline-block" />
                Hora pico de mayor facturación
              </span>
              <span>09:00 PM (Cierre)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
