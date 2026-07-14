import { describe, expect, it } from 'vitest'
import {
  imageAlternativesRule,
  imageDimensionsRule,
  imageSourcesRule,
  responsiveMediaRule,
  type RuleContext
} from '../../src/main/seo/rules'
import type { ImageEvidence, ImagesMediaEvidence } from '../../src/shared/seo-audit'

function image(overrides: Partial<ImageEvidence> = {}): ImageEvidence {
  return {
    sourceIndex: 0,
    src: '/image.png',
    currentSrc: 'https://site.test/image.png',
    alt: 'Description',
    role: null,
    visible: true,
    complete: true,
    intrinsicWidth: 800,
    intrinsicHeight: 400,
    renderedWidth: 400,
    renderedHeight: 200,
    widthAttribute: 800,
    heightAttribute: 400,
    srcset: '',
    sizes: '',
    pictureSources: [],
    loading: 'auto',
    decoding: 'auto',
    ...overrides
  }
}
function context(images: ImageEvidence[], media: ImagesMediaEvidence['media'] = []): RuleContext {
  return { imagesMedia: { images, media }, socialSharing: { images: [] } } as RuleContext
}

describe('images and media rules', () => {
  it('distinguishes meaningful missing alternatives from decorative images', () => {
    expect(imageAlternativesRule.evaluate(context([image({ alt: null })])).outcome).toBe('warning')
    expect(
      imageAlternativesRule.evaluate(
        context([image({ alt: '' }), image({ role: 'presentation', alt: null })])
      )
    ).toMatchObject({ outcome: 'passed' })
  })

  it('reports empty and browser-failed selected sources', () => {
    expect(
      imageSourcesRule.evaluate(
        context([
          image({
            src: null,
            currentSrc: null,
            srcset: '',
            complete: true,
            intrinsicWidth: 0,
            intrinsicHeight: 0
          })
        ])
      ).outcome
    ).toBe('error')
    expect(
      imageSourcesRule.evaluate(
        context([image({ complete: true, intrinsicWidth: 0, intrinsicHeight: 0 })])
      ).outcome
    ).toBe('error')
  })

  it('separates distortion from contextual missing dimensions', () => {
    expect(
      imageDimensionsRule.evaluate(context([image({ renderedWidth: 400, renderedHeight: 400 })]))
        .outcome
    ).toBe('warning')
    expect(
      imageDimensionsRule.evaluate(
        context([image({ widthAttribute: null, heightAttribute: null })])
      ).outcome
    ).toBe('opportunity')
  })

  it('keeps responsive selection, lazy loading, SVG/data sources, and media tracks inspectable', () => {
    const result = responsiveMediaRule.evaluate(
      context(
        [
          image({
            src: 'data:image/svg+xml,x',
            currentSrc: 'data:image/svg+xml,x',
            srcset: '/one.png 1x, /two.png 2x',
            sizes: '100vw',
            loading: 'lazy'
          })
        ],
        [
          {
            sourceIndex: 0,
            kind: 'video',
            src: '/movie.mp4',
            currentSrc: '/movie.mp4',
            poster: null,
            sources: [],
            tracks: [{ kind: 'captions', srclang: 'en', label: 'English' }],
            controls: true,
            autoplay: false,
            muted: false,
            preload: 'metadata',
            visible: true
          }
        ]
      )
    )
    expect(result).toMatchObject({ outcome: 'passed' })
    expect(result.evidence.detail).toContain('1 responsive')
    expect(result.evidence.detail).toContain('1 lazy')
  })
})
