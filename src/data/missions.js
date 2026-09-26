// Mission templates. "sum" accumulates across runs, "best" needs it in a single run.
export const MISSION_TEMPLATES = [
  { id: 'orbs', kind: 'sum', stat: 'orbs', text: (n) => `Eat ${n} stardust orbs`, targets: [30, 70, 140] },
  { id: 'score', kind: 'best', stat: 'score', text: (n) => `Score ${n} in one run`, targets: [400, 1100, 2400] },
  { id: 'combo', kind: 'best', stat: 'maxCombo', text: (n) => `Reach a x${n} combo`, targets: [4, 6, 8] },
  { id: 'ability', kind: 'sum', stat: 'abilityUses', text: (n) => `Use your ability ${n} times`, targets: [4, 10, 18] },
  { id: 'comets', kind: 'sum', stat: 'comets', text: (n) => `Catch ${n} comets`, targets: [2, 5, 10] },
  { id: 'runs', kind: 'sum', stat: 'runs', text: (n) => `Fly ${n} runs`, targets: [3, 5, 8] },
  { id: 'survive', kind: 'best', stat: 'seconds', text: (n) => `Survive ${n}s in one run`, targets: [45, 90, 160] },
  { id: 'powerups', kind: 'sum', stat: 'powerups', text: (n) => `Grab ${n} power-ups`, targets: [2, 5, 9] },
  { id: 'length', kind: 'best', stat: 'length', text: (n) => `Grow to length ${n}`, targets: [14, 24, 38] },
];
export const DAILY_REWARDS = [
  { stardust: 250, passXp: 350 }, { stardust: 450, passXp: 550 }, { stardust: 750, passXp: 850 },
];
export const WEEKLY_MULT = 5;
export const WEEKLY_REWARDS = [
  { stardust: 1500, passXp: 2000, crystals: 15 }, { stardust: 2500, passXp: 3000, crystals: 20 }, { stardust: 4000, passXp: 4500, crystals: 30 },
];
