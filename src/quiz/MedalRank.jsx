// Place at: src/quiz/MedalRank.jsx
const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' }

function MedalRank({ rank }) {
  return <span>{MEDALS[rank] || `#${rank}`}</span>
}

export default MedalRank
