// Purely a spike-visibility aid -- colors/sizes here are not the plan's actual
// visual design pass (that's Sprint 8, sec 5: "color language per shell,
// bloom/glow, starfield"). Good enough to tell shells apart while measuring FPS.

export interface ShellStyle {
  color: string
  radius: number
  opacity: number
}

export const SHELL_STYLE: Record<string, ShellStyle> = {
  '0': { color: '#ffffff', radius: 1.4, opacity: 1 }, // core -- "present, but unlit" per sec 0, kept bright here only so it's findable
  '1': { color: '#8ecbff', radius: 0.35, opacity: 1 }, // covering-band members
  '2': { color: '#4fd7ff', radius: 0.6, opacity: 1 }, // covering bands -- "bright shell" per sec 2.3
  '2a': { color: '#bff3ff', radius: 0.18, opacity: 0.9 }, // cover recordings -- small satellites
  '2b': { color: '#ffe066', radius: 0.5, opacity: 1 }, // cover releases / comps
  '3': { color: '#ff9d4d', radius: 0.6, opacity: 1 }, // original artists
  '3a': { color: '#ffc38a', radius: 0.35, opacity: 1 }, // original releases
  '3b': { color: '#ff7b54', radius: 0.18, opacity: 0.9 }, // original recordings
  '4': { color: '#5b5f6b', radius: 0.15, opacity: 0.35 }, // faint outer, personnel -- dim per sec 2.3
}

export const DEFAULT_SHELL_STYLE: ShellStyle = { color: '#ffffff', radius: 0.3, opacity: 1 }

export const EDGE_COLOR: Record<string, string> = {
  MEMBER_OF: '#8ecbff',
  performed_by: '#4fd7ff',
  APPEARS_ON: '#ffe066',
  COVERS: '#ff3b7f', // the cross-shell edge that's the whole point of the site -- made to stand out
  RELEASED: '#ff9d4d',
  CREDITED_ON: '#5b5f6b',
  PERFORMED_ON: '#5b5f6b',
}

export const DEFAULT_EDGE_COLOR = '#6b6375'
