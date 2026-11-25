// CyberBackground — decorative full-screen layer behind every page (rendered once in main.jsx).
// Pure decoration: no data, no numbers that look like results (hex glyphs only), no JS animation
// loop. Everything moves with CSS keyframes on transform/opacity (see .cyber-* in index.css), and
// only when the user has not asked for reduced motion. pointer-events: none, z-index below content.

// Network: three clusters of nodes. Each cluster drifts as one group, so its lines stay attached.
const CLUSTERS = [
  { nodes: [[90, 110], [210, 70], [300, 160], [170, 230], [60, 300], [260, 290], [360, 60]],
    links: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [3, 5], [2, 5], [1, 6], [2, 6]] },
  { nodes: [[700, 80], [820, 140], [930, 90], [760, 240], [900, 260], [980, 190], [640, 180]],
    links: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [2, 5], [0, 6], [6, 3], [1, 4]] },
  { nodes: [[120, 470], [250, 420], [380, 500], [520, 450], [650, 520], [800, 460]],
    links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [1, 3], [3, 5]] },
]

// Fixed hex glyphs for the falling "data stream" columns (decorative, never data).
const HEX = '3FA90C7E1B5D82F4C60A9E3D7B1258EFA04C9D6B23F7E8A15C0D94B7E26A3F18C5D0B79E4A2F6'
const COLUMNS = [
  { side: 'left', at: '1.5%', offset: 0, speed: 'slow' },
  { side: 'left', at: '4.5%', offset: 17, speed: 'fast' },
  { side: 'right', at: '1.5%', offset: 33, speed: 'fast' },
  { side: 'right', at: '4.5%', offset: 51, speed: 'slow' },
]

function streamText(offset) {
  const lines = []
  for (let i = 0; i < 24; i++) {
    const at = (offset + i * 5) % (HEX.length - 2)
    lines.push(HEX.slice(at, at + 2))
  }
  return lines.join('\n')
}

// One wavelength-repeating ribbon path (viewBox 0..1200 wide), drawn twice for a seamless loop.
function wavePath(amp, y) {
  let d = `M0 ${y}`
  for (let x = 0; x < 1200; x += 100) d += ` q25 ${-amp} 50 0 t50 0`
  return d
}

export default function CyberBackground() {
  return (
    <div aria-hidden="true" className="cyber">
      <div className="cyber-grid-wrap"><div className="cyber-grid" /></div>
      <div className="cyber-scan" />

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

      {COLUMNS.map((col) => {
        const text = streamText(col.offset)
        return (
          <div key={col.offset} className={`cyber-stream cyber-stream-${col.speed}`} style={{ [col.side]: col.at }}>
            <pre>{text}</pre>
            <pre>{text}</pre>
          </div>
        )
      })}

      <svg className="cyber-wave" viewBox="0 0 2400 80" preserveAspectRatio="none">
        <g className="cyber-wave-a">
          <path d={wavePath(28, 40)} />
          <path d={wavePath(28, 40)} transform="translate(1200 0)" />
        </g>
        <g className="cyber-wave-b">
          <path d={wavePath(16, 44)} />
          <path d={wavePath(16, 44)} transform="translate(1200 0)" />
        </g>
      </svg>
    </div>
  )
}
