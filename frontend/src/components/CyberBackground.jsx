// CyberBackground — decorative layer behind the AGENT DESK only (AgentLayout, staff sign-in).
// Pure decoration: no data, no numbers, no JS animation loop. A faint perspective grid and three
// slowly drifting node clusters, CSS keyframes only (see .cyber-* in index.css), and only when
// the user has not asked for reduced motion. Paused + faded in calm mode / "Reduce effects".

// Network: three clusters of nodes. Each cluster drifts as one group, so its lines stay attached.
const CLUSTERS = [
  { nodes: [[90, 110], [210, 70], [300, 160], [170, 230], [60, 300], [260, 290], [360, 60]],
    links: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [3, 5], [2, 5], [1, 6], [2, 6]] },
  { nodes: [[700, 80], [820, 140], [930, 90], [760, 240], [900, 260], [980, 190], [640, 180]],
    links: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [2, 5], [0, 6], [6, 3], [1, 4]] },
  { nodes: [[120, 470], [250, 420], [380, 500], [520, 450], [650, 520], [800, 460]],
    links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [1, 3], [3, 5]] },
]

export default function CyberBackground() {
  return (
    <div aria-hidden="true" className="cyber">
      <div className="cyber-grid-wrap"><div className="cyber-grid" /></div>
      <svg className="cyber-net" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
        {CLUSTERS.map((c, ci) => (
          <g key={ci} className={`cyber-cluster cyber-cluster-${ci}`}>
            {c.links.map(([a, b]) => (
              <line key={`${a}-${b}`} x1={c.nodes[a][0]} y1={c.nodes[a][1]} x2={c.nodes[b][0]} y2={c.nodes[b][1]} />
            ))}
            {c.nodes.map(([x, y], ni) => <circle key={ni} cx={x} cy={y} r={ni % 3 === 0 ? 3.5 : 2.5} />)}
          </g>
        ))}
      </svg>
    </div>
  )
}
