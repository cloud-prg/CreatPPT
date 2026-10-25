import type { DeckSpec, SlideSpec } from '../domain/types'

const CJK_RUN = /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/gu

/**
 * Count words with CJK awareness: every Han/Kana/Hangul character counts as
 * one word, while Latin and other scripts count by whitespace-separated runs.
 */
export function countWords(text: string | undefined | null): number {
  if (!text) return 0
  const cjkCount = (text.match(CJK_RUN) ?? []).length
  const latinWords = text.replace(CJK_RUN, ' ').split(/\s+/).filter(Boolean).length
  return cjkCount + latinWords
}

function slideWordCount(slide: SlideSpec): number {
  const parts = [
    slide.eyebrow,
    slide.title,
    slide.subtitle,
    slide.body,
    ...(slide.bullets ?? []),
    ...(slide.stats ?? []).flatMap(stat => [stat.value, stat.label, stat.detail]),
    ...(slide.columns ?? []).flatMap(column => [column.title, column.body, ...(column.bullets ?? [])]),
    ...(slide.steps ?? []).flatMap(step => [step.label, step.title, step.body]),
    ...(slide.chart?.points.map(point => point.label) ?? []),
    slide.quote,
    slide.quoteBy,
    slide.footer,
    slide.notes,
  ]
  return parts.reduce((total, part) => total + countWords(part), 0)
}

export interface DeckStats {
  slides: number
  words: number
  wordsBySlide: Array<{ id: string; title: string; words: number }>
  images: number
  imagesWithAlt: number
  layoutCounts: Record<string, number>
  densestSlide?: { index: number; id: string; title: string; words: number }
}

/** Read-side deck analytics for agents and humans reviewing a delivery. */
export function summarizeDeckStats(deck: DeckSpec): DeckStats {
  const wordsBySlide = deck.slides.map(slide => ({
    id: slide.id,
    title: slide.title,
    words: slideWordCount(slide),
  }))
  const layoutCounts: Record<string, number> = {}
  deck.slides.forEach(slide => {
    layoutCounts[slide.layout] = (layoutCounts[slide.layout] ?? 0) + 1
  })
  const images = deck.slides.flatMap(slide => slide.images ?? [])
  let densestSlide: DeckStats['densestSlide']
  wordsBySlide.forEach((entry, index) => {
    if (entry.words === 0) return
    if (!densestSlide || entry.words > densestSlide.words) {
      densestSlide = { index: index + 1, id: entry.id, title: entry.title, words: entry.words }
    }
  })
  return {
    slides: deck.slides.length,
    words: wordsBySlide.reduce((total, entry) => total + entry.words, 0),
    wordsBySlide,
    images: images.length,
    imagesWithAlt: images.filter(image => image.alt?.trim()).length,
    layoutCounts,
    densestSlide,
  }
}

function pushBullets(lines: string[], bullets: string[]): void {
  bullets.forEach(bullet => lines.push(`- ${bullet}`))
}

function pushSlideBody(lines: string[], slide: SlideSpec, language: string): void {
  if (slide.eyebrow) lines.push(`*${slide.eyebrow}*`, '')
  if (slide.subtitle) lines.push(`**${slide.subtitle}**`, '')
  if (slide.body) lines.push(slide.body, '')
  if (slide.bullets?.length) {
    pushBullets(lines, slide.bullets)
    lines.push('')
  }
  if (slide.stats?.length) {
    slide.stats.forEach(stat => {
      const detail = stat.detail ? ` — ${stat.detail}` : ''
      lines.push(`- **${stat.value}** ${stat.label}${detail}`)
    })
    lines.push('')
  }
  if (slide.columns?.length) {
    slide.columns.forEach(column => {
      lines.push(`### ${column.title}`, '')
      if (column.body) lines.push(column.body, '')
      if (column.bullets?.length) {
        pushBullets(lines, column.bullets)
        lines.push('')
      }
    })
  }
  if (slide.steps?.length) {
    slide.steps.forEach((step, index) => {
      const label = step.label ? `${step.label} · ` : ''
      const body = step.body ? ` ${step.body}` : ''
      lines.push(`${index + 1}. **${label}${step.title}**${body}`)
    })
    lines.push('')
  }
  if (slide.chart?.points.length) {
    const unit = slide.chart.unit ? ` (${slide.chart.unit})` : ''
    lines.push('| Label | Value' + unit + ' |', '| --- | --- |')
    slide.chart.points.forEach(point => lines.push(`| ${point.label} | ${point.value} |`))
    lines.push('')
  }
  if (slide.quote) {
    lines.push(`> ${slide.quote}`, '>', `> — ${slide.quoteBy ?? ''}`, '')
  }
  if (slide.images?.length) {
    slide.images.forEach(image => {
      lines.push(`![${image.alt ?? ''}](${image.src})`)
      if (image.caption) lines.push(`*${image.caption}*`)
    })
    lines.push('')
  }
  if (slide.notes) {
    const label = language.startsWith('zh') ? '讲者备注' : 'Speaker notes'
    lines.push(`<!-- ${label}: ${slide.notes} -->`, '')
  }
  if (slide.footer) lines.push(`---`, `*${slide.footer}*`, '')
}

/**
 * Render the deck's semantic content as a publishable Markdown outline.
 * Freeform canvas elements are intentionally not included: deck.json semantic
 * fields remain the durable content source.
 */
export function buildOutlineMarkdown(deck: DeckSpec): string {
  const language = deck.designContext?.language ?? ''
  const lines: string[] = [`# ${deck.title}`]
  if (deck.subtitle) lines.push('', `> ${deck.subtitle}`)
  deck.slides.forEach((slide, index) => {
    lines.push('', `## ${index + 1}. ${slide.title}`, '')
    pushSlideBody(lines, slide, language)
  })
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`
}
