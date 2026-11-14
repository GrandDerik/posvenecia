import React, { useState, useMemo } from 'react';
import { Sale } from '../types';
import { formatBs, formatUSD, getLocalDateStr, isSameLocalDate } from '../utils/exportUtils';
import { TrendingUp, Clock, Zap } from 'lucide-react';

interface HourlySalesChartProps {
  sales: Sale[];
  bcvRate: number;
}

interface HourlyPoint {
  hour: number;
  label: string;
  totalUSD: number;
  totalBs: number;
  cumulativeUSD: number;
  cumulativeBs: number;
  count: number;
}

/**
 * Generates a smooth cubic Bezier SVG path through a list of (x, y) coordinates.
 */
function buildSmoothSplinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return path;
}

export const HourlySalesChart: React.FC<HourlySalesChartProps> = ({ sales, bcvRate }) => {
  const [currency, setCurrency] = useState<'USD' | 'Bs'>('USD');
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  const todayStr = getLocalDateStr();

  const todaySales = useMemo(() => {
    return sales.filter((s) => s.status !== 'anulada' && isSameLocalDate(s.date, todayStr));
  }, [sales, todayStr]);

  // Aggregate by business hours (07:00 to 21:00, expanding if out-of-range sales exist)
  const hourlyData: HourlyPoint[] = useMemo(() => {
    const hoursMap: Record<number, { totalUSD: number; totalBs: number; count: number }> = {};
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

    const sortedHours = Object.keys(hoursMap)
      .map(Number)
      .sort((a, b) => a - b);

    let runningUSD = 0;
    let runningBs = 0;
    return sortedHours.map((hour) => {
      runningUSD += hoursMap[hour].totalUSD;
      runningBs += hoursMap[hour].totalBs;
      return {
        hour,
        label: `${hour.toString().padStart(2, '0')}:00`,
        totalUSD: hoursMap[hour].totalUSD,
        totalBs: hoursMap[hour].totalBs,
        cumulativeUSD: runningUSD,
        cumulativeBs: runningBs,
        count: hoursMap[hour].count,
      };
    });
  }, [todaySales]);

  const maxVal = useMemo(() => {
    const vals = hourlyData.map((d) => (currency === 'USD' ? d.totalUSD : d.totalBs));
    const peak = Math.max(...vals, 0);
    return peak > 0 ? peak * 1.18 : currency === 'USD' ? 50 : 2000;
  }, [hourlyData, currency]);

  const peakHour = useMemo(() => {
    let peak = hourlyData[0];
    hourlyData.forEach((d) => {
      const val = currency === 'USD' ? d.totalUSD : d.totalBs;
      const peakVal = peak ? (currency === 'USD' ? peak.totalUSD : peak.totalBs) : 0;
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

  // SVG Coordinate System
  const svgW = 860;
  const svgH = 220;
  const padL = 26;
  const padR = 26;
  const padT = 26;
  const padB = 34;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;
  const baseY = padT + chartH;

  const coords = useMemo(() => {
    const count = hourlyData.length;
    return hourlyData.map((d, idx) => {
      const val = currency === 'USD' ? d.totalUSD : d.totalBs;
      const x = count > 1 ? padL + (idx / (count - 1)) * chartW : padL + chartW / 2;
      const ratio = maxVal > 0 ? val / maxVal : 0;
      const y = baseY - Math.max(0, Math.min(1, ratio)) * chartH;
      return { ...d, x, y, val };
    });
  }, [hourlyData, currency, maxVal, chartW, chartH, baseY]);

  const linePath = useMemo(() => buildSmoothSplinePath(coords), [coords]);
  const areaPath = useMemo(() => {
    if (coords.length === 0) return '';
    const first = coords[0];
    const last = coords[coords.length - 1];
    return `${linePath} L ${last.x.toFixed(2)} ${baseY.toFixed(2)} L ${first.x.toFixed(2)} ${baseY.toFixed(2)} Z`;
  }, [linePath, coords, baseY]);

  // Active point for floating tooltip (hovered/selected or peak hour by default when there are sales)
  const activePoint = useMemo(() => {
    if (todaySales.length === 0) return null;
    if (selectedHour !== null) {
      return coords.find((c) => c.hour === selectedHour) || null;
    }
    if (peakHour) {
      return coords.find((c) => c.hour === peakHour.hour) || null;
    }
    return null;
  }, [todaySales.length, selectedHour, coords, peakHour]);

  return (
    <div className="bg-white/95 rounded-3xl p-5 sm:p-6 border border-[#DCE4F0] shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] space-y-5">
      {/* Header and Currency Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#EBF3FE] border border-[#C5DCFC] flex items-center justify-center text-[#2563EB] shrink-0">
            <TrendingUp className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-[#0B1528] tracking-tight uppercase">
              Curva de Ventas del Día
            </h3>
            <p className="text-xs text-slate-500">
              Distribución y flujo de ingresos por hora en la jornada de hoy
            </p>
          </div>
        </div>

        {/* Currency Switcher */}
        <div className="flex items-center gap-1 bg-[#F1F5F9] p-1 rounded-xl self-start sm:self-auto border border-[#DCE4F0]">
          <button
            type="button"
            onClick={() => setCurrency('USD')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              currency === 'USD'
                ? 'bg-white text-[#0B1528] shadow-xs border border-[#DCE4F0]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Dólares ($ USD)
          </button>
          <button
            type="button"
            onClick={() => setCurrency('Bs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              currency === 'Bs'
                ? 'bg-white text-[#0B1528] shadow-xs border border-[#DCE4F0]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bolívares (Bs.)
          </button>
        </div>
      </div>

      {/* 4 KPI Sub-cards inside chart panel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3.5">
          <div className="text-[11px] font-bold text-slate-500">Total Facturado Hoy</div>
          <div className="text-lg sm:text-xl font-extrabold text-[#0B1528] font-mono-numbers mt-0.5">
            {currency === 'USD' ? `$${formatUSD(totalDayUSD)}` : `Bs. ${formatBs(totalDayBs)}`}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {todaySales.length} {todaySales.length === 1 ? 'transacción' : 'transacciones'}
          </div>
        </div>

        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3.5">
          <div className="text-[11px] font-bold text-slate-500">Ticket Promedio</div>
          <div className="text-lg sm:text-xl font-extrabold text-[#4F46E5] font-mono-numbers mt-0.5">
            {currency === 'USD' ? `$${formatUSD(avgTicketUSD)}` : `Bs. ${formatBs(avgTicketBs)}`}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Por venta registrada</div>
        </div>

        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3.5">
          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-[#D97706]" />
            <span>Hora Pico</span>
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-[#D97706] font-mono-numbers mt-0.5">
            {peakHour ? peakHour.label : 'Sin ventas'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {peakHour ? `${peakHour.count} ${peakHour.count === 1 ? 'venta' : 'ventas'}` : 'A la espera'}
          </div>
        </div>

        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3.5">
          <div className="text-[11px] font-bold text-slate-500">Tasa Oficial BCV</div>
          <div className="text-lg sm:text-xl font-extrabold text-[#16A34A] font-mono-numbers mt-0.5">
            Bs. {formatBs(bcvRate)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Por cada 1.00 USD</div>
        </div>
      </div>

      {/* Smooth SVG Area Spline Chart */}
      <div className="relative pt-2">
        {todaySales.length === 0 ? (
          <div className="h-48 border border-dashed border-[#CBD5E1] bg-[#F8FAFC]/70 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <Clock className="w-8 h-8 text-slate-300 mb-2 stroke-[1.5]" />
            <p className="text-xs font-bold text-slate-600">No se han registrado ventas en la jornada de hoy aún</p>
            <p className="text-[11px] text-slate-400 mt-1">
              A medida que realices cobros en caja, la curva de facturación se actualizará en vivo
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Floating Interactive Tooltip matching screenshot */}
            {activePoint && (
              <div
                style={{
                  left: `${Math.min(82, Math.max(18, (activePoint.x / svgW) * 100))}%`,
                  top: `${Math.max(4, (activePoint.y / svgH) * 100 - 18)}%`,
                }}
                className="hidden sm:block absolute -translate-x-1/2 -translate-y-full z-20 pointer-events-none bg-white/95 backdrop-blur-xs border border-[#DCE4F0] rounded-xl px-3 py-2 shadow-[0_10px_25px_-6px_rgba(15,23,42,0.16)] text-[11px] whitespace-nowrap transition-all duration-150"
              >
                <div className="flex items-center justify-between gap-3 text-slate-500">
                  <span>Ventas ({activePoint.label}):</span>
                  <strong className="font-mono-numbers text-[#0B1528]">
                    {currency === 'USD' ? `$${formatUSD(activePoint.totalUSD)}` : `Bs. ${formatBs(activePoint.totalBs)}`}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-3 text-slate-500 mt-0.5">
                  <span>Acumulado:</span>
                  <strong className="font-mono-numbers text-[#2563EB]">
                    {currency === 'USD' ? `$${formatUSD(activePoint.cumulativeUSD)}` : `Bs. ${formatBs(activePoint.cumulativeBs)}`}
                  </strong>
                </div>
              </div>
            )}

            {/* Mobile compact active hour summary */}
            {activePoint && (
              <div className="sm:hidden mb-2 flex items-center justify-between bg-[#F4F8FF] border border-[#BFDBFE] rounded-xl px-3 py-2 text-[11px]">
                <span className="font-bold text-slate-600">
                  {activePoint.label} ({activePoint.count} ops)
                </span>
                <div className="font-mono-numbers flex items-center gap-2">
                  <span className="font-extrabold text-[#0B1528]">
                    {currency === 'USD' ? `$${formatUSD(activePoint.totalUSD)}` : `Bs. ${formatBs(activePoint.totalBs)}`}
                  </span>
                  <span className="text-[#2563EB] font-bold">
                    Acum: {currency === 'USD' ? `$${formatUSD(activePoint.cumulativeUSD)}` : `Bs. ${formatBs(activePoint.cumulativeBs)}`}
                  </span>
                </div>
              </div>
            )}

            <div className="w-full overflow-x-auto scrollbar-none">
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="w-full min-w-[540px] h-52 sm:h-56 select-none overflow-visible"
                role="img"
                aria-label="Curva de ventas por hora del día"
              >
                <defs>
                  <linearGradient id="posveneciaAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.30" />
                    <stop offset="65%" stopColor="#60A5FA" stopOpacity="0.10" />
                    <stop offset="100%" stopColor="#EFF6FF" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Subtle horizontal baseline and mid grid */}
                <line x1={padL} y1={padT + chartH * 0.25} x2={svgW - padR} y2={padT + chartH * 0.25} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 4" />
                <line x1={padL} y1={padT + chartH * 0.55} x2={svgW - padR} y2={padT + chartH * 0.55} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 4" />
                <line x1={padL} y1={baseY} x2={svgW - padR} y2={baseY} stroke="#CBD5E1" strokeWidth="1.2" />

                {/* Vertical dashed marker on active point and peak hour */}
                {peakHour && (() => {
                  const pk = coords.find((c) => c.hour === peakHour.hour);
                  if (!pk) return null;
                  return (
                    <line
                      x1={pk.x}
                      y1={padT}
                      x2={pk.x}
                      y2={baseY}
                      stroke="#94A3B8"
                      strokeWidth="1.2"
                      strokeDasharray="3 4"
                      opacity="0.7"
                    />
                  );
                })()}

                {activePoint && (!peakHour || activePoint.hour !== peakHour.hour) && (
                  <line
                    x1={activePoint.x}
                    y1={padT}
                    x2={activePoint.x}
                    y2={baseY}
                    stroke="#3B82F6"
                    strokeWidth="1.2"
                    strokeDasharray="3 4"
                    opacity="0.75"
                  />
                )}

                {/* Gradient Area Fill */}
                <path d={areaPath} fill="url(#posveneciaAreaGrad)" />

                {/* Smooth Blue Spline Curve */}
                <path
                  d={linePath}
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data Point Nodes & Interactive Hit Zones */}
                {coords.map((pt) => {
                  const isActive = activePoint?.hour === pt.hour;
                  const isPeak = peakHour?.hour === pt.hour;
                  const hasSales = pt.val > 0;

                  return (
                    <g
                      key={pt.hour}
                      className="cursor-pointer"
                      onMouseEnter={() => setSelectedHour(pt.hour)}
                      onMouseLeave={() => setSelectedHour(null)}
                      onClick={() => setSelectedHour(selectedHour === pt.hour ? null : pt.hour)}
                    >
                      {/* Invisible generous hit area */}
                      <rect
                        x={pt.x - chartW / (coords.length * 2)}
                        y={padT}
                        width={chartW / coords.length}
                        height={chartH + 28}
                        fill="transparent"
                      />

                      {/* Outer ring when active or peak */}
                      {(isActive || isPeak) && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isActive ? 7 : 5.5}
                          fill="#DBEAFE"
                          stroke="#2563EB"
                          strokeWidth="1.5"
                        />
                      )}

                      {/* Core node dot */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isActive ? 4 : hasSales ? 3.5 : 2.5}
                        fill={isActive || hasSales ? '#1D4ED8' : '#93C5FD'}
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />

                      {/* Hour Label */}
                      <text
                        x={pt.x}
                        y={baseY + 20}
                        textAnchor="middle"
                        className="font-mono-numbers"
                        fontSize="11"
                        fontWeight={isActive || isPeak ? '700' : '600'}
                        fill={isActive ? '#1D4ED8' : '#64748B'}
                      >
                        {pt.hour}h
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              <span>07:00 AM Inicio jornada</span>
              <span className="flex items-center gap-1.5 font-semibold text-slate-600">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#2563EB] inline-block" />
                <span>Franja de mayor facturación</span>
              </span>
              <span>09:00 PM Cierre</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
