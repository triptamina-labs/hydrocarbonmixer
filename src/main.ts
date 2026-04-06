import './style.css';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
  ScatterController,
} from 'chart.js';
import type { LegendItem, Scale, TooltipItem } from 'chart.js';
import {
  PROPANE_ANTOINE,
  ISOBUTANE_ANTOINE,
  PROPANE_CRIT,
  ISOBUTANE_CRIT,
  BAR_TO_PSI,
  vaporPressureBar,
  mixLiquidDensity,
  liquidDensity,
  mixCritical,
  linspace,
} from './chemistry';

Chart.register(
  LineController,
  ScatterController,
  LineElement,
  PointElement,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
);

/** Colores de ejes/tooltip alineados con DecarbTime */
const CHART_TICK = '#8b8d94';
const CHART_GRID = 'rgba(255, 255, 255, 0.06)';
const CHART_AXIS_BORDER = '#2a2d35';
const TOOLTIP_BG = '#1e2027';
const TOOLTIP_TITLE = '#e4e5e7';
const TOOLTIP_BODY = '#8b8d94';
const TOOLTIP_BORDER = '#2a2d35';
/** Curva / puntos de mezcla: acento principal (mismo azul que sliders) */
const MIX_LINE = '#5b9bf5';
const MIX_FILL = 'rgba(91, 155, 245, 0.08)';

// ── DOM helpers ──

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ── Shared state ──

let xPercent = 70;
const xFrac = () => xPercent / 100;

type PUnit = 'bar' | 'psi' | 'kPa' | 'atm';
type TUnit = 'C' | 'F' | 'K';

let pUnit: PUnit = 'psi';
let tUnit: TUnit = 'C';

// ── Unit conversion ──

function convertP(bar: number): number {
  switch (pUnit) {
    case 'bar': return bar;
    case 'psi': return bar * BAR_TO_PSI;
    case 'kPa': return bar * 100;
    case 'atm': return bar / 1.01325;
  }
}

function pLabel(): string {
  return pUnit;
}

function convertPsiToUnit(psi: number): number {
  return convertP(psi / BAR_TO_PSI);
}

function formatThreshold(psi: number): string {
  return `${convertPsiToUnit(psi).toFixed(pUnit === 'bar' || pUnit === 'atm' ? 1 : 0)} ${pLabel()}`;
}

function updateThresholdLabels() {
  $('thresh-caution-val').textContent = formatThreshold(threshCaution);
  $('thresh-danger-val').textContent = formatThreshold(threshDanger);
}

function convertT(celsius: number): number {
  switch (tUnit) {
    case 'C': return celsius;
    case 'F': return celsius * 9 / 5 + 32;
    case 'K': return celsius + 273.15;
  }
}

function tLabel(): string {
  switch (tUnit) {
    case 'C': return '°C';
    case 'F': return '°F';
    case 'K': return 'K';
  }
}

// ── Safety thresholds (in psi) ──

let threshCaution = 150;
let threshDanger = 250;

// ── Settings modal ──

const settingsToggle = $<HTMLButtonElement>('settings-toggle');
const settingsPanel = $('settings-panel');
const settingsOverlay = $('settings-overlay');
const settingsClose = $('settings-close');
const unitPressureSelect = $<HTMLSelectElement>('unit-pressure');
const unitTempSelect = $<HTMLSelectElement>('unit-temp');
const threshCautionSlider = $<HTMLInputElement>('thresh-caution');
const threshDangerSlider = $<HTMLInputElement>('thresh-danger');

function openSettings() {
  settingsPanel.classList.add('open');
  settingsOverlay.classList.add('open');
  settingsToggle.classList.add('active');
}

function closeSettings() {
  settingsPanel.classList.remove('open');
  settingsOverlay.classList.remove('open');
  settingsToggle.classList.remove('active');
}

settingsToggle.addEventListener('click', () => {
  settingsPanel.classList.contains('open') ? closeSettings() : openSettings();
});

settingsOverlay.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeSettings();
});
settingsClose.addEventListener('click', (e) => {
  e.preventDefault();
  closeSettings();
});

// ── Acerca del modelo (carrusel como DecarbTime / DabPurge) ──

const docsToggle = $<HTMLButtonElement>('docs-toggle');
const infoOverlay = document.getElementById('info-overlay')!;
const docSlides = document.querySelectorAll<HTMLElement>('#carousel [data-slide]');
const dotsContainer = document.getElementById('dots')!;
const pageIndicatorEl = document.getElementById('page-indicator')!;
const btnPrevDoc = document.getElementById('btn-prev') as HTMLButtonElement;
const btnNextDoc = document.getElementById('btn-next') as HTMLButtonElement;
const docTotal = docSlides.length;
let docCurrent = 0;

for (let i = 0; i < docTotal; i++) {
  dotsContainer.appendChild(document.createElement('span'));
}
const docDots = dotsContainer.querySelectorAll('span');

function goToDocSlide(idx: number) {
  docCurrent = Math.max(0, Math.min(docTotal - 1, idx));
  docSlides.forEach((s, i) => s.classList.toggle('active', i === docCurrent));
  docDots.forEach((d, i) => d.classList.toggle('active', i === docCurrent));
  pageIndicatorEl.textContent = `${docCurrent + 1} / ${docTotal}`;
  btnPrevDoc.disabled = docCurrent === 0;
  btnNextDoc.disabled = docCurrent === docTotal - 1;
}

goToDocSlide(0);

btnPrevDoc.addEventListener('click', () => goToDocSlide(docCurrent - 1));
btnNextDoc.addEventListener('click', () => goToDocSlide(docCurrent + 1));
docDots.forEach((d, i) => d.addEventListener('click', () => goToDocSlide(i)));

let docSwipeX0: number | null = null;
const carouselDoc = document.getElementById('carousel')!;
carouselDoc.addEventListener(
  'touchstart',
  (e) => {
    docSwipeX0 = e.touches[0].clientX;
  },
  { passive: true },
);
carouselDoc.addEventListener('touchend', (e) => {
  if (docSwipeX0 === null) return;
  const dx = e.changedTouches[0].clientX - docSwipeX0;
  if (Math.abs(dx) > 40) goToDocSlide(docCurrent + (dx < 0 ? 1 : -1));
  docSwipeX0 = null;
});

document.addEventListener('keydown', (e) => {
  if (infoOverlay.classList.contains('hidden')) return;
  if (e.key === 'Escape') infoOverlay.classList.add('hidden');
  if (e.key === 'ArrowRight') goToDocSlide(docCurrent + 1);
  if (e.key === 'ArrowLeft') goToDocSlide(docCurrent - 1);
});

docsToggle.addEventListener('click', () => {
  goToDocSlide(0);
  infoOverlay.classList.remove('hidden');
});
document.getElementById('btn-close')!.addEventListener('click', () => {
  infoOverlay.classList.add('hidden');
});
document.querySelector('#info-overlay .overlay-inner')!.addEventListener('click', (e) => {
  e.stopPropagation();
});
infoOverlay.addEventListener('click', () => {
  infoOverlay.classList.add('hidden');
});

unitPressureSelect.addEventListener('change', () => {
  pUnit = unitPressureSelect.value as PUnit;
  updateThresholdLabels();
  rebuildAllCharts();
});

unitTempSelect.addEventListener('change', () => {
  tUnit = unitTempSelect.value as TUnit;
  rebuildAllCharts();
});

threshCautionSlider.addEventListener('input', () => {
  threshCaution = Number(threshCautionSlider.value);
  updateThresholdLabels();
  updateTankPressure();
});

threshDangerSlider.addEventListener('input', () => {
  threshDanger = Number(threshDangerSlider.value);
  updateThresholdLabels();
  updateTankPressure();
});

// ── Global composition slider ──

const gSlider = $<HTMLInputElement>('g-slider');
const gSliderVal = $<HTMLSpanElement>('g-slider-val');

// ── Tab system ──

const tabBtns = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
const tabPanels = document.querySelectorAll<HTMLElement>('.tab-panel');
let activeTab = 'vapor';

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab!;
    if (tab === activeTab) return;
    activeTab = tab;
    tabBtns.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    tabPanels.forEach((p) => p.classList.toggle('active', p.id === `panel-${tab}`));
    refreshActiveTab();
  });
});

// ═══════════════════════════════════════════════
// TAB 1: Diagrama P-T (Presión de Vapor)
// ═══════════════════════════════════════════════

function saturationCurve(
  antoine: { A: number; B: number; C: number },
  TcK: number,
): { x: number[]; y: number[] } {
  const tMax = TcK - 273.15;
  const tRange = linspace(-50, Math.min(tMax - 1, 150), 300);
  return { x: tRange, y: tRange.map((t) => vaporPressureBar(antoine, t)) };
}

function mixSatCurve(xProp: number): { x: number[]; y: number[] } {
  const crit = mixCritical(xProp);
  const tMax = crit.Tc - 273.15;
  const tRange = linspace(-50, Math.min(tMax - 1, 150), 300);
  return {
    x: tRange,
    y: tRange.map((t) => {
      const pp = vaporPressureBar(PROPANE_ANTOINE, t);
      const pi = vaporPressureBar(ISOBUTANE_ANTOINE, t);
      return xProp * pp + (1 - xProp) * pi;
    }),
  };
}

function toScatterConverted(curve: { x: number[]; y: number[] }) {
  return curve.x.map((cx, i) => ({ x: convertT(cx), y: convertP(curve.y[i]) }));
}

const propSat = saturationCurve(PROPANE_ANTOINE, PROPANE_CRIT.Tc);
const isobSat = saturationCurve(ISOBUTANE_ANTOINE, ISOBUTANE_CRIT.Tc);

const tankTempSlider = $<HTMLInputElement>('tank-temp');

function critMixReadoutLine(xMix: number): string {
  const c = mixCritical(xMix);
  return `${convertT(c.Tc - 273.15).toFixed(1)} ${tLabel()} · ${convertP(c.Pc).toFixed(1)} ${pLabel()}`;
}

function mixVaporPressureBar(xProp: number, tempC: number): number {
  const pp = vaporPressureBar(PROPANE_ANTOINE, tempC);
  const pi = vaporPressureBar(ISOBUTANE_ANTOINE, tempC);
  return xProp * pp + (1 - xProp) * pi;
}

function tankSliderPoint(): { x: number; y: number } {
  const tempC = Number(tankTempSlider.value);
  const pBar = mixVaporPressureBar(xFrac(), tempC);
  return { x: convertT(tempC), y: convertP(pBar) };
}

function vaporPMax(): number {
  return convertP(50);
}

function vaporTRange(): { min: number; max: number } {
  return { min: convertT(-50), max: convertT(160) };
}

const vaporChart = new Chart($<HTMLCanvasElement>('chart-vapor'), {
  type: 'scatter',
  data: {
    datasets: [
      {
        label: 'Propano',
        data: toScatterConverted(propSat),
        borderColor: 'rgba(239,68,68,0.4)',
        backgroundColor: 'rgba(239,68,68,0.4)',
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        showLine: true,
        tension: 0.4,
      },
      {
        label: 'Isobutano',
        data: toScatterConverted(isobSat),
        borderColor: 'rgba(59,130,246,0.4)',
        backgroundColor: 'rgba(59,130,246,0.4)',
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        showLine: true,
        tension: 0.4,
      },
      {
        label: `Mezcla (${xPercent} %)`,
        data: toScatterConverted(mixSatCurve(xFrac())),
        borderColor: MIX_LINE,
        backgroundColor: MIX_FILL,
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 4,
        showLine: true,
        tension: 0.4,
      },
      {
        label: 'Pc Propano',
        data: [{ x: convertT(PROPANE_CRIT.Tc - 273.15), y: convertP(PROPANE_CRIT.Pc) }],
        borderColor: '#f87171',
        backgroundColor: '#f87171',
        pointRadius: 6,
        pointStyle: 'star',
        showLine: false,
      },
      {
        label: 'Pc Isobutano',
        data: [{ x: convertT(ISOBUTANE_CRIT.Tc - 273.15), y: convertP(ISOBUTANE_CRIT.Pc) }],
        borderColor: '#60a5fa',
        backgroundColor: '#60a5fa',
        pointRadius: 6,
        pointStyle: 'star',
        showLine: false,
      },
      {
        label: 'Pc Mezcla (Kay)',
        data: [(() => { const c = mixCritical(xFrac()); return { x: convertT(c.Tc - 273.15), y: convertP(c.Pc) }; })()],
        borderColor: MIX_LINE,
        backgroundColor: MIX_LINE,
        pointRadius: 7,
        pointStyle: 'star',
        showLine: false,
      },
      {
        label: 'T ambiente',
        data: [tankSliderPoint()],
        borderColor: '#fff',
        backgroundColor: MIX_LINE,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointStyle: 'circle',
        showLine: false,
        borderWidth: 2,
        order: -1,
      },
    ],
  },
  options: scatterChartOptions(),
});

function scatterChartOptions() {
  const tRange = vaporTRange();
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 200 },
    interaction: { mode: 'nearest' as const, intersect: false },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: CHART_TICK,
          font: { family: 'Inter', size: 11 },
          boxWidth: 12,
          boxHeight: 2,
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: TOOLTIP_BG,
        titleColor: TOOLTIP_TITLE,
        bodyColor: TOOLTIP_BODY,
        borderColor: TOOLTIP_BORDER,
        borderWidth: 1,
        cornerRadius: 6,
        padding: 10,
        callbacks: {
          label: (ctx: { raw: unknown; dataset: { label?: string } }) => {
            const p = ctx.raw as { x: number; y: number };
            return ` ${ctx.dataset.label}: ${p.x.toFixed(1)} ${tLabel()}, ${p.y.toFixed(2)} ${pLabel()}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear' as const,
        title: {
          display: true,
          text: `Temperatura (${tLabel()})`,
          color: CHART_TICK,
          font: { family: 'Inter', size: 13, weight: 'normal' as const },
        },
        min: tRange.min,
        max: tRange.max,
        ticks: { color: CHART_TICK, font: { family: 'Inter', size: 10 } },
        grid: { color: CHART_GRID },
        border: { color: CHART_AXIS_BORDER },
      },
      y: {
        type: 'linear' as const,
        title: {
          display: true,
          text: `Presión (${pLabel()})`,
          color: CHART_TICK,
          font: { family: 'Inter', size: 13, weight: 'normal' as const },
        },
        min: 0,
        max: vaporPMax(),
        ticks: { color: CHART_TICK, font: { family: 'Inter', size: 10 } },
        grid: { color: CHART_GRID },
        border: { color: CHART_AXIS_BORDER },
      },
    },
  };
}

function updateVaporTab() {
  const x = xFrac();

  vaporChart.data.datasets[0].data = toScatterConverted(propSat);
  vaporChart.data.datasets[1].data = toScatterConverted(isobSat);
  vaporChart.data.datasets[2].data = toScatterConverted(mixSatCurve(x));
  vaporChart.data.datasets[2].label = `Mezcla (${xPercent} %)`;
  vaporChart.data.datasets[3].data = [{ x: convertT(PROPANE_CRIT.Tc - 273.15), y: convertP(PROPANE_CRIT.Pc) }];
  vaporChart.data.datasets[4].data = [{ x: convertT(ISOBUTANE_CRIT.Tc - 273.15), y: convertP(ISOBUTANE_CRIT.Pc) }];

  const crit = mixCritical(x);
  vaporChart.data.datasets[5].data = [{ x: convertT(crit.Tc - 273.15), y: convertP(crit.Pc) }];

  const opts = scatterChartOptions();
  vaporChart.options.scales!.x = opts.scales.x;
  vaporChart.options.scales!.y = opts.scales.y;
  vaporChart.options.plugins!.tooltip = opts.plugins.tooltip;
  vaporChart.update('none');

  $('crit-mix').textContent = critMixReadoutLine(x);

  updateTankPressure();
}

function updateTankPressure() {
  const tempC = Number(tankTempSlider.value);
  const valStr = `${convertT(tempC).toFixed(0)} ${tLabel()}`;
  const minStr = `${convertT(-20).toFixed(0)} ${tLabel()}`;
  const maxStr = `${convertT(100).toFixed(0)} ${tLabel()}`;
  $('tank-temp-val').textContent = valStr;
  $('tank-temp-min').textContent = minStr;
  $('tank-temp-max').textContent = maxStr;

  const pBar = mixVaporPressureBar(xFrac(), tempC);
  const pConverted = convertP(pBar);
  const pPsi = pBar * BAR_TO_PSI;

  vaporChart.data.datasets[6].data = [{ x: convertT(tempC), y: convertP(pBar) }];
  vaporChart.update('none');

  updateDensityTempMarker();
  densityChart.update('none');

  const x = xFrac();
  const dens = mixLiquidDensity(x, tempC);
  $('mix-dens-label').textContent = `Densidad mezcla @ ${convertT(tempC).toFixed(0)} ${tLabel()}`;
  $('mix-dens').textContent = dens !== null ? `${dens.toFixed(4)} g/mL` : '—';
  const Mmix = x * PROPANE_CRIT.M + (1 - x) * ISOBUTANE_CRIT.M;
  $('mix-mm').textContent = `${Mmix.toFixed(2)} g/mol`;

  const pressureMain = `${pConverted.toFixed(1)} ${pLabel()}`;
  $('tank-psi').textContent = pressureMain;

  const secondaryParts: string[] = [];
  if (pUnit !== 'bar') secondaryParts.push(`${pBar.toFixed(2)} bar`);
  if (pUnit !== 'psi') secondaryParts.push(`${pPsi.toFixed(1)} psi`);
  if (pUnit !== 'kPa') secondaryParts.push(`${(pBar * 100).toFixed(0)} kPa`);
  const secondaryStr = secondaryParts.slice(0, 2).join(' · ');
  $('tank-secondary').textContent = secondaryStr;

  let zone: 'safe' | 'caution' | 'danger';
  let zoneText: string;

  if (pPsi < threshCaution) {
    zone = 'safe';
    zoneText = 'Seguro';
  } else if (pPsi < threshDanger) {
    zone = 'caution';
    zoneText = 'Precaución';
  } else {
    zone = 'danger';
    zoneText = 'Peligro — Alta presión';
  }

  const safetyClass = `info-card tank-pressure-card vapor-stats-card ${zone}`;
  $('safety-card').className = safetyClass;
  $('safety-text').textContent = zoneText;
}

tankTempSlider.addEventListener('input', () => {
  updateTankPressure();
});

// ═══════════════════════════════════════════════
// TAB 2: Density Chart
// ═══════════════════════════════════════════════

const DENS_T_MIN = -60;
const DENS_T_MAX = 100;
const DENS_N = 400;
/** Marcas del eje X cada 20 °C (valores en °C; se convierten con convertT) */
const DENS_TICK_TEMPS_C = [-60, -40, -20, 0, 20, 40, 60, 80, 100] as const;
const densTempsC = linspace(DENS_T_MIN, DENS_T_MAX, DENS_N);

function densityXYArray(fn: (t: number) => number | null): { x: number; y: number | null }[] {
  return densTempsC.map((t) => ({
    x: convertT(t),
    y: fn(t),
  }));
}

/** Punto en la curva de mezcla alineado con el slider de temperatura (índice de dataset 3) */
function updateDensityTempMarker(): void {
  const tempC = Number(tankTempSlider.value);
  const xMix = xFrac();
  const dens = mixLiquidDensity(xMix, tempC);
  const ds = densityChart.data.datasets[3];
  if (dens != null && Number.isFinite(dens)) {
    ds.data = [{ x: convertT(tempC), y: dens }];
  } else {
    ds.data = [];
  }
}

const densityChart = new Chart($<HTMLCanvasElement>('chart-density'), {
  type: 'line',
  data: {
    datasets: [
      {
        label: 'Propano 100 %',
        data: densityXYArray((t) => liquidDensity(PROPANE_CRIT, t)),
        borderColor: 'rgba(239,68,68,0.4)',
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        tension: 0.4,
        spanGaps: true,
      },
      {
        label: 'Isobutano 100 %',
        data: densityXYArray((t) => liquidDensity(ISOBUTANE_CRIT, t)),
        borderColor: 'rgba(59,130,246,0.4)',
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        tension: 0.4,
        spanGaps: true,
      },
      {
        label: `Mezcla (${xPercent} %)`,
        data: densityXYArray((t) => mixLiquidDensity(xFrac(), t)),
        borderColor: MIX_LINE,
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: MIX_LINE,
        tension: 0.4,
        spanGaps: true,
      },
      {
        label: 'Temperatura del tanque',
        data: [] as { x: number; y: number }[],
        borderColor: '#fff',
        backgroundColor: MIX_LINE,
        pointRadius: 5,
        pointHoverRadius: 7,
        borderWidth: 2,
        showLine: false,
        order: -1,
      },
    ],
  },
  options: densChartOptions(),
});

function densChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 200 } as const,
    interaction: { mode: 'nearest' as const, intersect: false, axis: 'x' as const },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: CHART_TICK,
          font: { family: 'Inter', size: 11 },
          boxWidth: 14,
          boxHeight: 2,
          padding: 14,
          filter: (item: LegendItem) => item.datasetIndex !== 3,
        },
      },
      tooltip: {
        backgroundColor: TOOLTIP_BG,
        titleColor: TOOLTIP_TITLE,
        bodyColor: TOOLTIP_BODY,
        borderColor: TOOLTIP_BORDER,
        borderWidth: 1,
        cornerRadius: 6,
        padding: 10,
        titleFont: { family: 'Inter', weight: 'bold' as const },
        bodyFont: { family: 'Inter' },
        callbacks: {
          title: (items: TooltipItem<'line'>[]) => {
            const x = items[0]?.parsed.x;
            return `${x != null ? x.toFixed(1) : '—'} ${tLabel()}`;
          },
          label: (item: TooltipItem<'line'>) => {
            const y = item.parsed.y;
            const yStr = y != null && Number.isFinite(y) ? y.toFixed(4) : '—';
            return ` ${item.dataset.label}: ${yStr} g/mL`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear' as const,
        min: convertT(DENS_T_MIN),
        max: convertT(DENS_T_MAX),
        title: {
          display: true,
          text: `Temperatura (${tLabel()})`,
          color: CHART_TICK,
          font: { family: 'Inter', size: 13, weight: 'normal' as const },
        },
        afterBuildTicks: (scale: Scale) => {
          scale.ticks = [...DENS_TICK_TEMPS_C].map((tc) => ({ value: convertT(tc) }));
        },
        ticks: {
          color: CHART_TICK,
          font: { family: 'Inter', size: 10 },
          maxRotation: 0,
          callback: (tickValue: string | number) => {
            const n = typeof tickValue === 'number' ? tickValue : Number(tickValue);
            return Number.isFinite(n) ? n.toFixed(0) : String(tickValue);
          },
        },
        grid: { color: CHART_GRID },
        border: { color: CHART_AXIS_BORDER },
      },
      y: {
        type: 'linear' as const,
        min: 0.3,
        max: 0.7,
        title: {
          display: true,
          text: 'Densidad (g/mL)',
          color: CHART_TICK,
          font: { family: 'Inter', size: 13, weight: 'normal' as const },
        },
        ticks: {
          color: CHART_TICK,
          font: { family: 'Inter', size: 10 },
          stepSize: 0.05,
        },
        grid: { color: CHART_GRID },
        border: { color: CHART_AXIS_BORDER },
      },
    },
  };
}

function updateDensityTab() {
  const x = xFrac();
  densityChart.data.datasets[0].data = densityXYArray((t) => liquidDensity(PROPANE_CRIT, t));
  densityChart.data.datasets[1].data = densityXYArray((t) => liquidDensity(ISOBUTANE_CRIT, t));
  densityChart.data.datasets[2].data = densityXYArray((t) => mixLiquidDensity(x, t));
  densityChart.data.datasets[2].label = `Mezcla (${xPercent} %)`;
  updateDensityTempMarker();

  const opts = densChartOptions();
  densityChart.options.scales!.x = opts.scales.x;
  densityChart.options.scales!.y = opts.scales.y;
  densityChart.options.plugins!.tooltip = opts.plugins.tooltip;
  densityChart.update('none');

  $('crit-mix').textContent = critMixReadoutLine(x);

  updateTankPressure();
}

// ═══════════════════════════════════════════════
// Global refresh
// ═══════════════════════════════════════════════

function refreshActiveTab() {
  switch (activeTab) {
    case 'vapor':   updateVaporTab();   break;
    case 'density': updateDensityTab(); break;
  }
}

function rebuildAllCharts() {
  updateVaporTab();
  updateDensityTab();
}

function updateCompBarColor(): void {
  const pct = `${xPercent}%`;
  gSlider.style.setProperty('--g-slider-pct', pct);
}

function onCompositionInput(): void {
  xPercent = Number(gSlider.value);
  gSliderVal.textContent = `${xPercent}\u00A0%`;
  updateCompBarColor();
  refreshActiveTab();
}

gSlider.addEventListener('input', onCompositionInput);

updateCompBarColor();
refreshActiveTab();
