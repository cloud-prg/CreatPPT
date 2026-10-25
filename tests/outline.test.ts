import { describe, expect, it } from 'vitest'
import { buildOutlineMarkdown, countWords, summarizeDeckStats } from '@/cli/outline'
import type { DeckSpec } from '@/domain/types'

function buildDeck(overrides: Partial<DeckSpec> = {}): DeckSpec {
  return {
    version: 2,
    id: 'fixture-deck',
    title: '测试演示稿',
    subtitle: '从内部汇报到自媒体内容',
    templateId: 'signal',
    updatedAt: '2026-10-25T00:00:00.000Z',
    designContext: { language: 'zh-CN' },
    slides: [
      {
        id: 'fixture-deck-cover',
        layout: 'cover',
        title: '测试演示稿',
        subtitle: '一份用于测试的封面',
        images: [{ src: 'assets/cover.jpg', alt: '封面图' }],
      },
      {
        id: 'fixture-deck-metrics',
        layout: 'metrics',
        title: '时间配比',
        body: '写作占比最高，因为纪律在写作阶段建立。',
        stats: [
          { value: '40%', label: '写作与结构' },
          { value: '20%', label: '可视化', detail: '图优先于表' },
        ],
      },
      {
        id: 'fixture-deck-timeline',
        layout: 'timeline',
        title: '制作流程',
        steps: [
          { label: '第 1 步', title: '定选题' },
          { label: '第 2 步', title: '列大纲', body: '每页一个观点' },
        ],
        notes: '提醒大家带上周的项目复盘',
      },
      {
        id: 'fixture-deck-quote',
        layout: 'quote',
        title: '引用',
        quote: '不能简单地解释，就是还没有真正理解。',
        quoteBy: '费曼',
      },
    ],
    ...overrides,
  }
}

describe('countWords', () => {
  it('counts CJK characters individually', () => {
    expect(countWords('技术分享')).toBe(4)
  })

  it('counts Latin words and mixed text', () => {
    expect(countWords('hello world')).toBe(2)
    expect(countWords('用 Vue 3 做技术分享')).toBe(8)
  })

  it('returns zero for empty input', () => {
    expect(countWords(undefined)).toBe(0)
    expect(countWords('')).toBe(0)
  })
})

describe('summarizeDeckStats', () => {
  it('counts slides, images and layout distribution', () => {
    const stats = summarizeDeckStats(buildDeck())
    expect(stats.slides).toBe(4)
    expect(stats.images).toBe(1)
    expect(stats.imagesWithAlt).toBe(1)
    expect(stats.layoutCounts).toEqual({ cover: 1, metrics: 1, timeline: 1, quote: 1 })
  })

  it('finds the densest slide by CJK-aware word count', () => {
    const stats = summarizeDeckStats(buildDeck())
    expect(stats.densestSlide?.title).toBe('时间配比')
    expect(stats.densestSlide?.index).toBe(2)
    expect(stats.words).toBe(stats.wordsBySlide.reduce((total, entry) => total + entry.words, 0))
  })

  it('omits densest slide for an empty deck', () => {
    const stats = summarizeDeckStats(buildDeck({ slides: [] }))
    expect(stats.slides).toBe(0)
    expect(stats.densestSlide).toBeUndefined()
  })
})

describe('buildOutlineMarkdown', () => {
  it('renders deck title, subtitle and numbered slides', () => {
    const markdown = buildOutlineMarkdown(buildDeck())
    expect(markdown).toContain('# 测试演示稿')
    expect(markdown).toContain('> 从内部汇报到自媒体内容')
    expect(markdown).toContain('## 2. 时间配比')
    expect(markdown.endsWith('\n')).toBe(true)
  })

  it('renders metrics as bold stat bullets and steps as an ordered list', () => {
    const markdown = buildOutlineMarkdown(buildDeck())
    expect(markdown).toContain('- **40%** 写作与结构')
    expect(markdown).toContain('- **20%** 可视化 — 图优先于表')
    expect(markdown).toContain('1. **第 1 步 · 定选题**')
    expect(markdown).toContain('2. **第 2 步 · 列大纲** 每页一个观点')
  })

  it('renders quotes as blockquote with attribution', () => {
    const markdown = buildOutlineMarkdown(buildDeck())
    expect(markdown).toContain('> 不能简单地解释，就是还没有真正理解。')
    expect(markdown).toContain('> — 费曼')
  })

  it('keeps speaker notes as an HTML comment using deck language', () => {
    const zh = buildOutlineMarkdown(buildDeck())
    expect(zh).toContain('<!-- 讲者备注: 提醒大家带上周的项目复盘 -->')
    const en = buildOutlineMarkdown(buildDeck({ designContext: { language: 'en' } }))
    expect(en).toContain('<!-- Speaker notes: 提醒大家带上周的项目复盘 -->')
  })

  it('renders images with alt text', () => {
    const markdown = buildOutlineMarkdown(buildDeck())
    expect(markdown).toContain('![封面图](assets/cover.jpg)')
  })
})
