import kernelSrc from './figures/kernel.js?raw'
import { empathize } from './art/empathize'
import { define } from './art/define'
import { ideate } from './art/ideate'
import { refine } from './art/refine'
import { iterate } from './art/iterate'
import type { Figure } from './art/common'

/**
 * The process illustrations, drawn with the Hairline kernel (evaluated once, unchanged) for its camera,
 * rounded solids, springs and shared frame loop. Each illustration lives in ./art.
 */
export type FigureName = 'empathize' | 'define' | 'ideate' | 'refine' | 'iterate'
const ART = { empathize, define, ideate, refine, iterate }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let HL: any = null
function kernel() {
  if (!HL) {
    HL = new Function(`${kernelSrc}\n;return HL;`)()
    HL.inject(document)
  }
  return HL
}

export function mountFigure(name: FigureName, stage: HTMLElement, label: string): Figure {
  const hl = kernel()
  stage.setAttribute('data-hairline', name)
  stage.setAttribute('role', 'img')
  stage.setAttribute('aria-label', label)
  return ART[name](hl, stage)
}
