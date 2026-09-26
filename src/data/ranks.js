export const RANK_DIVISIONS = [
  { id: 'bronze',   name: 'Bronze',   elo: 0,    color: '#CD7F32', icon: '🥉' },
  { id: 'silver',   name: 'Silver',   elo: 800,  color: '#C0C0C0', icon: '🥈' },
  { id: 'gold',     name: 'Gold',     elo: 1200, color: '#FFD700', icon: '🥇' },
  { id: 'platinum', name: 'Platinum', elo: 1600, color: '#E5E4E2', icon: '💎' },
  { id: 'diamond',  name: 'Diamond',  elo: 2000, color: '#B9F2FF', icon: '♦️' },
  { id: 'master',   name: 'Master',   elo: 2400, color: '#7F00FF', icon: '👑' },
  { id: 'grandmaster', name: 'Grandmaster', elo: 2800, color: '#FF0000', icon: '✨' },
  { id: 'legend',   name: 'Legend',   elo: 3200, color: '#FFFF00', icon: '🌟' },
];

export const divisionById = (id) => RANK_DIVISIONS.find((d) => d.id === id) || RANK_DIVISIONS[0];
export const divisionByElo = (elo) => {
  let div = RANK_DIVISIONS[0];
  for (const d of RANK_DIVISIONS) {
    if (elo >= d.elo) div = d;
  }
  return div;
};
