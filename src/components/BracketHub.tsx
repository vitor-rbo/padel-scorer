import {
  bracketChampion,
  bracketPlayed,
  canPlay,
  isDone,
  matchScoreText,
  matchStarted,
  structureFor,
} from '../tournament/bracket'
import type { Bracket } from '../tournament/bracket'
import { formatLabel } from '../archive'
import { BH, BW, GAP, TOP, colX, layout } from './bracketLayout'
import type { Box, Link } from './bracketLayout'

interface Props {
  bracket: Bracket
  onOpen: (match: number) => void
  onHome: () => void
  onEnd: () => void
}

/** The bracket overview: drawn as a bracket, with the teams filled in as results come in. */
export function BracketHub({ bracket: b, onOpen, onHome, onEnd }: Props) {
  const champ = bracketChampion(b)
  const total = structureFor(b).length

  const confirmEnd = () => {
    if (window.confirm('End this tournament? All its results will be deleted.')) onEnd()
  }

  return (
    <main className="tournament">
      <div className="setup-top">
        <button type="button" className="back" onClick={onHome}>
          ← Home
        </button>
        <button type="button" className="back" onClick={confirmEnd}>
          End tournament
        </button>
      </div>
      <h1>Double elimination</h1>
      <p className="lead-small">
        {bracketPlayed(b)} of {total} matches played ·{' '}
        {b.config ? formatLabel(b.config) : `${b.points} points each`}. Tap a match to play it.
      </p>

      {champ !== null && (
        <section className="panel win-A" role="status">
          <p className="result">🏆 {b.teams[champ]} are the champions!</p>
        </section>
      )}

      <div className="bracket-wrap">
        <BracketDiagram bracket={b} onOpen={onOpen} />
      </div>
    </main>
  )
}

function clip(s: string, max = 14): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

function BracketDiagram({ bracket: b, onOpen }: { bracket: Bracket; onOpen: (i: number) => void }) {
  const { boxes, links, structure } = layout(b)
  const all = Object.values(boxes)
  const width = colX(Math.max(...all.map((x) => x.col))) + BW + 8
  const height = TOP + Math.max(...all.map((x) => x.y)) + BH / 2 + 8

  // Section titles sit just above the first box of each part.
  const firstLosers = structure.findIndex((s) => s.section === 'Losers bracket')
  const losersTop = Math.min(boxes[links[firstLosers].a].y, boxes[links[firstLosers].b].y)
  const finalBox = boxes[`o${structure.length - 1}`]

  return (
    <svg
      className="bracket"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="group"
      aria-label="Double elimination bracket"
    >
      <text className="bk-title" x={colX(0)} y={14}>
        Winners bracket
      </text>
      <text className="bk-title" x={colX(0)} y={TOP + losersTop - BH / 2 - 14}>
        Losers bracket
      </text>
      <text className="bk-title" x={colX(finalBox.col)} y={TOP + finalBox.y - BH / 2 - 8}>
        Grand final
      </text>

      {links.map((l) => (
        <MatchLines key={l.match} link={l} boxes={boxes} bracket={b} onOpen={onOpen} />
      ))}

      {Object.entries(boxes).map(([key, box]) => (
        <g key={key}>
          <rect
            className={`bk-box ${box.won ? 'won' : ''}`}
            x={colX(box.col)}
            y={TOP + box.y - BH / 2}
            width={BW}
            height={BH}
            rx={8}
          />
          <text
            className={`bk-name ${box.empty ? 'empty' : ''} ${box.won ? 'won' : ''}`}
            x={colX(box.col) + BW / 2}
            y={TOP + box.y}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {clip(box.text)}
          </text>
        </g>
      ))}
    </svg>
  )
}

/** The "[" joining a match's two boxes to the next box, plus the button that opens the match. */
function MatchLines(props: {
  link: Link
  boxes: Record<string, Box>
  bracket: Bracket
  onOpen: (i: number) => void
}) {
  const { link, boxes, bracket: b } = props
  const a = boxes[link.a]
  const c = boxes[link.b]
  const o = boxes[link.out]
  const xa = colX(a.col) + BW
  const xc = colX(c.col) + BW
  const xo = colX(o.col)
  const xMid = xo - GAP / 2
  const ya = TOP + a.y
  const yb = TOP + c.y
  const yo = TOP + o.y
  const i = link.match

  const ready = canPlay(b, i)
  const done = isDone(b, i)
  const started = matchStarted(b, i)
  const label = started ? matchScoreText(b, i) : ready ? 'Play' : `M${i + 1}`
  const open = () => ready && props.onOpen(i)
  const top = Math.min(ya, yb)

  return (
    <g
      className={`bk-match ${ready ? 'ready' : ''} ${done ? 'done' : ''}`}
      role="button"
      tabIndex={ready ? 0 : -1}
      aria-disabled={!ready}
      aria-label={`Match ${i + 1}: ${a.text || 'to be decided'} versus ${c.text || 'to be decided'}${
        started ? `, score ${label}` : ''
      }`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      }}
    >
      <path className="bk-line" d={`M${xa} ${ya}H${xMid}V${yb}H${xc}M${xMid} ${yo}H${xo}`} />
      {/* A big invisible target so the whole "[" is easy to tap on a phone. */}
      <rect x={xMid - GAP / 2} y={top - 4} width={GAP} height={Math.abs(yb - ya) + 8} fill="transparent" />
      <rect className="bk-pill" x={xMid - 26} y={yo - 13} width={52} height={26} rx={13} />
      <text className="bk-pill-text" x={xMid} y={yo} textAnchor="middle" dominantBaseline="central">
        {label}
      </text>
    </g>
  )
}
