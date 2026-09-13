import { describe, it, expect } from 'vitest'
import { makeTextElement, makeShapeElement, makeImageElement, DEFAULT_ELEMENT_SIZE } from './elementModel'

describe('elementModel factories', () => {
  it('makeTextElement fills base defaults and a text payload', () => {
    const el = makeTextElement({ content: 'Hello' })
    expect(el.kind).toBe('text')
    expect(el.text).toEqual({ variant: 'body', content: 'Hello', align: 'left', bold: false })
    expect(el.width).toBe(DEFAULT_ELEMENT_SIZE.text.width)
    expect(el.rotation).toBe(0)
    expect(el.zIndex).toBe(1)
    expect(el.locked).toBe(false)
    expect(el.visible).toBe(true)
  })

  it('makeShapeElement defaults to a rectangle with sensible styling', () => {
    const el = makeShapeElement()
    expect(el.kind).toBe('shape')
    expect(el.shape).toBe('rectangle')
    expect(el.fill).toBe('#e5e7eb')
  })

  it('makeImageElement defaults fit to cover', () => {
    const el = makeImageElement({ src: 'https://example.com/a.png' })
    expect(el.kind).toBe('image')
    expect(el.fit).toBe('cover')
    expect(el.src).toBe('https://example.com/a.png')
  })

  it('every factory produces a unique id', () => {
    const ids = new Set([makeTextElement().id, makeShapeElement().id, makeImageElement().id, makeTextElement().id])
    expect(ids.size).toBe(4)
  })

  it('overrides win over defaults', () => {
    const el = makeShapeElement({ x: 10, y: 20, width: 40, zIndex: 5 })
    expect(el.x).toBe(10)
    expect(el.y).toBe(20)
    expect(el.width).toBe(40)
    expect(el.zIndex).toBe(5)
  })
})
