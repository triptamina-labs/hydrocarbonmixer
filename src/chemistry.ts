// ── Antoine constants (P in bar, T in K) ──

export const PROPANE_ANTOINE = { A: 3.92271, B: 803.997, C: -26.11 };
export const ISOBUTANE_ANTOINE = { A: 3.93020, B: 890.960, C: -37.26 };

export const BAR_TO_PSI = 14.5038;
export const ATM_PSI = 14.696;

// ── Critical properties ──

export const PROPANE_CRIT = {
  Tc: 369.83,  // K
  Pc: 42.48,   // bar
  M: 44.096,   // g/mol
  Zra: 0.2763, // Rackett parameter
};

export const ISOBUTANE_CRIT = {
  Tc: 407.80,
  Pc: 36.40,
  M: 58.122,
  Zra: 0.2753,
};

const R_GAS = 83.14; // cm³·bar/(mol·K)

export interface AntoineParams {
  A: number;
  B: number;
  C: number;
}

export interface CriticalProps {
  Tc: number;
  Pc: number;
  M: number;
  Zra: number;
}

// ── Core calculations ──

export function vaporPressureBar(p: AntoineParams, tempC: number): number {
  const T_K = tempC + 273.15;
  return 10 ** (p.A - p.B / (T_K + p.C));
}

export function vaporPressurePsi(p: AntoineParams, tempC: number): number {
  return vaporPressureBar(p, tempC) * BAR_TO_PSI;
}

export function mixVaporPressurePsi(xProp: number, tempC: number): number {
  const pp = vaporPressurePsi(PROPANE_ANTOINE, tempC);
  const pi = vaporPressurePsi(ISOBUTANE_ANTOINE, tempC);
  return xProp * pp + (1 - xProp) * pi;
}

/**
 * Rackett equation: saturated liquid molar volume (cm³/mol)
 * Valid only when T < Tc
 */
export function liquidMolarVolume(crit: CriticalProps, tempC: number): number | null {
  const T_K = tempC + 273.15;
  if (T_K >= crit.Tc) return null;
  const Tr = T_K / crit.Tc;
  const exponent = 1 + (1 - Tr) ** (2 / 7);
  return (R_GAS * crit.Tc / crit.Pc) * crit.Zra ** exponent;
}

/** Liquid density in g/mL (= kg/L) via Rackett equation */
export function liquidDensity(crit: CriticalProps, tempC: number): number | null {
  const V = liquidMolarVolume(crit, tempC);
  if (V === null || V <= 0) return null;
  return crit.M / V;
}

/** Mixture liquid density using ideal molar-volume mixing */
export function mixLiquidDensity(xProp: number, tempC: number): number | null {
  const V1 = liquidMolarVolume(PROPANE_CRIT, tempC);
  const V2 = liquidMolarVolume(ISOBUTANE_CRIT, tempC);
  if (V1 === null || V2 === null) return null;
  const Vmix = xProp * V1 + (1 - xProp) * V2;
  const Mmix = xProp * PROPANE_CRIT.M + (1 - xProp) * ISOBUTANE_CRIT.M;
  return Mmix / Vmix;
}

/** Mixture critical point via Kay's rule */
export function mixCritical(xProp: number) {
  return {
    Tc: xProp * PROPANE_CRIT.Tc + (1 - xProp) * ISOBUTANE_CRIT.Tc,
    Pc: xProp * PROPANE_CRIT.Pc + (1 - xProp) * ISOBUTANE_CRIT.Pc,
  };
}

// ── Utility ──

export function linspace(start: number, end: number, n: number): number[] {
  const step = (end - start) / (n - 1);
  return Array.from({ length: n }, (_, i) => start + step * i);
}

export function findBoilingPointC(xProp: number): number | null {
  const temps = linspace(-50, 100, 500);
  for (let i = 0; i < temps.length - 1; i++) {
    const p0 = mixVaporPressurePsi(xProp, temps[i]);
    const p1 = mixVaporPressurePsi(xProp, temps[i + 1]);
    if (p0 <= ATM_PSI && p1 >= ATM_PSI) {
      const frac = (ATM_PSI - p0) / (p1 - p0);
      return temps[i] + frac * (temps[i + 1] - temps[i]);
    }
  }
  return null;
}
