import type { RunState } from '../model';

export type HeatStage = 'normal' | 'suspicious' | 'checked' | 'hunted' | 'lockdown';

export function addHeat(current: number, delta: number): number {
  return Math.max(0, Math.min(100, current + delta));
}

export function heatStage(heat: number): HeatStage {
  if (heat >= 100) return 'lockdown';
  if (heat >= 75) return 'hunted';
  if (heat >= 50) return 'checked';
  if (heat >= 25) return 'suspicious';
  return 'normal';
}

export const heatLabels: Record<HeatStage, string> = {
  normal: '平静', suspicious: '起疑', checked: '盘查', hunted: '追捕', lockdown: '封寨',
};

export function canUseGate(run: RunState): boolean {
  const checkAt = run.flags.includes('known_style') ? 40 : 50;
  return run.locationId === 'gate' && (run.heat < checkAt || run.flags.includes('gate_cleared')) && run.heat < 100;
}
