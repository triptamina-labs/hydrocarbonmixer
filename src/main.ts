import './style.css';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
  ScatterController,
} from 'chart.js';
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
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
);

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

// ── Docs modal (tarjetas) ──

const DOCS_N = 6;
const docsToggle = $<HTMLButtonElement>('docs-toggle');
const docsBackdrop = $('docs-backdrop');
const docsPrevBtn = $<HTMLButtonElement>('docs-prev');
const docsNextBtn = $<HTMLButtonElement>('docs-next');
const docsCounter = $('docs-counter');
const docsCards = document.querySelectorAll<HTMLElement>('.docs-card');

let docsIndex = 0;

function updateDocsCard() {
  docsCards.forEach((card, i) => {
    card.classList.toggle('active', i === docsIndex);
  });
  docsCounter.textContent = `${docsIndex + 1} / ${DOCS_N}`;
  docsPrevBtn.disabled = docsIndex === 0;
  docsNextBtn.disabled = docsIndex === DOCS_N - 1;
}

function openDocs() {
  docsIndex = 0;
  updateDocsCard();
  docsBackdrop.classList.add('open');
}

function closeDocs() {
  docsBackdrop.classList.remove('open');
}

docsToggle.addEventListener('click', () => {
  if (docsBackdrop.classList.contains('open')) closeDocs();
  else openDocs();
});

// Cerrar al hacer clic en overlay o en botón cerrar (delegación en document)
document.addEventListener(
  'click',
  (e) => {
    if (!docsBackdrop.classList.contains('open')) return;
    const t = e.target as HTMLElement;
    const isOverlay = t.id === 'docs-overlay' || t.classList.contains('docs-backdrop__overlay');
    const isCloseBtn = t.id === 'docs-close' || t.closest('#docs-close');
    const isBackdrop = t.id === 'docs-backdrop';
    if (isOverlay || isCloseBtn || isBackdrop) closeDocs();
  },
  true
);

// Escape y flechas para cerrar/navegar (captura para tener prioridad)
document.addEventListener(
  'keydown',
  (e) => {
    if (!docsBackdrop.classList.contains('open')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDocs();
    }
    if (e.key === 'ArrowLeft') docsPrevBtn.click();
    if (e.key === 'ArrowRight') docsNextBtn.click();
  },
  true
);

docsPrevBtn.addEventListener('click', () => {
  if (docsIndex > 0) {
    docsIndex--;
    updateDocsCard();
  }
});

docsNextBtn.addEventListener('click', () => {
  if (docsIndex < DOCS_N - 1) {
    docsIndex++;
    updateDocsCard();
  }
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
const gSliderVal = $<HTMLOutputElement>('g-slider-val');

// ── Tab system ──

const tabBtns = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
const tabPanels = document.querySelectorAll<HTMLElement>('.tab-panel');
let activeTab = 'vapor';

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab!;
    if (tab === activeTab) return;
    activeTab = tab;
    tabBtns.forEach((b) => b.classList.toggle('active', b === btn));
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
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168,85,247,0.06)',
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 4,
        showLine: true,
        tension: 0.4,
        fill: 'origin',
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
        borderColor: '#a855f7',
        backgroundColor: '#a855f7',
        pointRadius: 7,
        pointStyle: 'star',
        showLine: false,
      },
      {
        label: 'T ambiente',
        data: [tankSliderPoint()],
        borderColor: '#fff',
        backgroundColor: '#a855f7',
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
          color: '#8888a0',
          font: { family: 'Inter', size: 11 },
          boxWidth: 12,
          boxHeight: 2,
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(18,18,26,0.95)',
        titleColor: '#e8e8f0',
        bodyColor: '#aaaabc',
        borderColor: '#2a2a3a',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
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
          color: '#8888a0',
          font: { family: 'Inter', size: 13, weight: 'normal' as const },
        },
        min: tRange.min,
        max: tRange.max,
        ticks: { color: '#666680', font: { family: 'Inter', size: 11 } },
        grid: { color: 'rgba(255,255,255,0.06)' },
        border: { color: '#2a2a3a' },
      },
      y: {
        type: 'linear' as const,
        title: {
          display: true,
          text: `Presión (${pLabel()})`,
          color: '#8888a0',
          font: { family: 'Inter', size: 13, weight: 'normal' as const },
        },
        min: 0,
        max: vaporPMax(),
        ticks: { color: '#666680', font: { family: 'Inter', size: 11 } },
        grid: { color: 'rgba(255,255,255,0.06)' },
        border: { color: '#2a2a3a' },
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

  const critTc = convertT(crit.Tc - 273.15);
  const critPc = convertP(crit.Pc);
  $('crit-mix').textContent = `${critTc.toFixed(1)} ${tLabel()} · ${critPc.toFixed(1)} ${pLabel()}`;

  const tempC = Number(tankTempSlider.value);
  const dens = mixLiquidDensity(x, tempC);
  const Mmix = x * PROPANE_CRIT.M + (1 - x) * ISOBUTANE_CRIT.M;
  $('mix-dens').textContent = dens !== null ? `${dens.toFixed(4)} g/mL` : '—';
  $('mix-mm').textContent = `${Mmix.toFixed(2)} g/mol`;

  updateTankPressure();
}

function updateTankPressure() {
  const tempC = Number(tankTempSlider.value);
  $('tank-temp-val').textContent = `${convertT(tempC).toFixed(0)} ${tLabel()}`;
  $('tank-temp-min').textContent = `${convertT(-20).toFixed(0)} ${tLabel()}`;
  $('tank-temp-max').textContent = `${convertT(100).toFixed(0)} ${tLabel()}`;

  const pBar = mixVaporPressureBar(xFrac(), tempC);
  const pConverted = convertP(pBar);
  const pPsi = pBar * BAR_TO_PSI;

  vaporChart.data.datasets[6].data = [{ x: convertT(tempC), y: convertP(pBar) }];
  vaporChart.update('none');

  const x = xFrac();
  const dens = mixLiquidDensity(x, tempC);
  $('mix-dens').textContent = dens !== null ? `${dens.toFixed(4)} g/mL` : '—';

  $('tank-psi').textContent = `${pConverted.toFixed(1)} ${pLabel()}`;

  const secondaryParts: string[] = [];
  if (pUnit !== 'bar') secondaryParts.push(`${pBar.toFixed(2)} bar`);
  if (pUnit !== 'psi') secondaryParts.push(`${pPsi.toFixed(1)} psi`);
  if (pUnit !== 'kPa') secondaryParts.push(`${(pBar * 100).toFixed(0)} kPa`);
  $('tank-secondary').textContent = secondaryParts.slice(0, 2).join(' · ');

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

  $('safety-card').className = `info-card tank-pressure-card ${zone}`;
  $('safety-text').textContent = zoneText;
}

tankTempSlider.addEventListener('input', updateTankPressure);

// ═══════════════════════════════════════════════
// TAB 2: Density Chart
// ═══════════════════════════════════════════════

const DENS_T_MIN = -50;
const DENS_T_MAX = 80;
const DENS_N = 400;
const densTempsC = linspace(DENS_T_MIN, DENS_T_MAX, DENS_N);

function densityArray(fn: (t: number) => number | null): (number | null)[] {
  return densTempsC.map(fn);
}

function densLabelsConverted(): string[] {
  return densTempsC.map((t) => convertT(t).toFixed(1));
}

const densityChart = new Chart($<HTMLCanvasElement>('chart-density'), {
  type: 'line',
  data: {
    labels: densLabelsConverted(),
    datasets: [
      {
        label: 'Propano 100 %',
        data: densityArray((t) => liquidDensity(PROPANE_CRIT, t)),
        borderColor: 'rgba(239,68,68,0.4)',
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        tension: 0.4,
      },
      {
        label: 'Isobutano 100 %',
        data: densityArray((t) => liquidDensity(ISOBUTANE_CRIT, t)),
        borderColor: 'rgba(59,130,246,0.4)',
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        tension: 0.4,
      },
      {
        label: `Mezcla (${xPercent} %)`,
        data: densityArray((t) => mixLiquidDensity(xFrac(), t)),
        borderColor: '#a855f7',
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: '#a855f7',
        tension: 0.4,
        fill: { target: 'origin', above: 'rgba(168,85,247,0.06)' },
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
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#8888a0',
          font: { family: 'Inter', size: 11 },
          boxWidth: 14,
          boxHeight: 2,
          padding: 14,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(18,18,26,0.95)',
        titleColor: '#e8e8f0',
        bodyColor: '#aaaabc',
        borderColor: '#2a2a3a',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        titleFont: { family: 'Inter', weight: 'bold' as const },
        bodyFont: { family: 'Inter' },
        callbacks: {
          title: (items: { label: string }[]) => `${items[0].label} ${tLabel()}`,
          label: (item: { dataset: { label?: string }; raw: unknown }) =>
            ` ${item.dataset.label}: ${Number(item.raw).toFixed(4)} g/mL`,
        },
      },
    },
    scales: {
      x: {
        type: 'category' as const,
        title: {
          display: true,
          text: `Temperatura (${tLabel()})`,
          color: '#8888a0',
          font: { family: 'Inter', size: 13, weight: 'normal' as const },
        },
        ticks: {
          color: '#666680',
          font: { family: 'Inter', size: 11 },
          maxTicksLimit: 12,
          maxRotation: 0,
        },
        grid: { color: 'rgba(255,255,255,0.06)' },
        border: { color: '#2a2a3a' },
      },
      y: {
        type: 'linear' as const,
        min: 0,
        max: 0.7,
        title: {
          display: true,
          text: 'Densidad (g/mL)',
          color: '#8888a0',
          font: { family: 'Inter', size: 13, weight: 'normal' as const },
        },
        ticks: {
          color: '#666680',
          font: { family: 'Inter', size: 11 },
          stepSize: 0.05,
        },
        grid: { color: 'rgba(255,255,255,0.06)' },
        border: { color: '#2a2a3a' },
      },
    },
  };
}

function updateDensityTab() {
  const x = xFrac();
  densityChart.data.labels = densLabelsConverted();
  densityChart.data.datasets[2].data = densityArray((t) => mixLiquidDensity(x, t));
  densityChart.data.datasets[2].label = `Mezcla (${xPercent} %)`;

  const opts = densChartOptions();
  densityChart.options.scales!.x = opts.scales.x;
  densityChart.options.plugins!.tooltip = opts.plugins.tooltip;
  densityChart.update('none');

  const d25 = mixLiquidDensity(x, 25);
  const dm40 = mixLiquidDensity(x, -40);
  const Mmix = x * PROPANE_CRIT.M + (1 - x) * ISOBUTANE_CRIT.M;

  $('dens25-value').textContent = d25 !== null ? `${d25.toFixed(4)} g/mL` : '—';
  $('dens-40-value').textContent = dm40 !== null ? `${dm40.toFixed(4)} g/mL` : '—';
  $('mmolar-value').textContent = `${Mmix.toFixed(2)} g/mol`;
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
  gSlider.style.setProperty('--g-slider-pct', `${gSlider.value}%`);
}

gSlider.addEventListener('input', () => {
  xPercent = Number(gSlider.value);
  gSliderVal.textContent = `${xPercent} %`;
  updateCompBarColor();
  refreshActiveTab();
});

updateCompBarColor();
refreshActiveTab();
