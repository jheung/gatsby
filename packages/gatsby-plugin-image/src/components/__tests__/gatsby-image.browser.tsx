import React from "react"
import { GatsbyImage, ISharpGatsbyImageData } from "../gatsby-image.browser"
import { render, waitFor } from "@testing-library/react"
import * as hooks from "../hooks"

type GlobalOverride = NodeJS.Global &
  typeof global.globalThis & {
    GATSBY___IMAGE: boolean
    SERVER: boolean
  }

// Prevents terser for bailing because we're not in a babel plugin
jest.mock(`../../../macros/terser.macro`, () => (strs): string => strs.join(``))

describe(`GatsbyImage browser`, () => {
  let beforeHydrationContent: HTMLDivElement
  let image: ISharpGatsbyImageData

  beforeEach(() => {
    console.warn = jest.fn()
    ;(global as GlobalOverride).SERVER = true
    ;(global as GlobalOverride).GATSBY___IMAGE = true
  })

  beforeEach(() => {
    image = {
      width: 100,
      height: 100,
      layout: `fluid`,
      images: { fallback: { src: `some-src-fallback.jpg` } },
      placeholder: { sources: [] },
      sizes: `192x192`,
      backgroundColor: `red`,
    }

    beforeHydrationContent = document.createElement(`div`)
    beforeHydrationContent.innerHTML = `
      <div
        class="gatsby-image-wrapper"
        data-gatsby-image-wrapper=""
        style="position: relative; display: inline-block;"
      >
        <div
          style="max-width: 100px; display: block;"
        >
          <img
            alt=""
            aria-hidden="true"
            role="presentation"
            src="data:image/svg+xml;charset=utf-8,%3Csvg height='100' width='100' xmlns='http://www.w3.org/2000/svg' version='1.1'%3E%3C/svg%3E"
            style="max-width: 100%; display: block; position: static;"
          />
        </div>
        <div
          aria-hidden="true"
          data-placeholder-image=""
          sources=""
          style="opacity: 1; transition: opacity 500ms linear; display: inline-block; background-color: red; position: relative;"
        />
        <img
          alt="A fake image for testing purpose"
          data-gatsby-image-ssr=""
          data-main-image=""
          data-src="some-src-fallback.jpg"
          decoding="async"
          loading="lazy"
          sizes="192x192"
          style="opacity: 0;"
        />
      </div>`
  })

  afterEach(() => {
    jest.clearAllMocks()
    ;(global as GlobalOverride).SERVER = undefined
    ;(global as GlobalOverride).GATSBY___IMAGE = undefined
  })

  it(`shows a suggestion to switch to the new gatsby-image API when available`, async () => {
    ;(global as GlobalOverride).GATSBY___IMAGE = false

    const { container } = render(
      <GatsbyImage image={image} alt="Alt content" />
    )

    await waitFor(() => container.querySelector(`[data-placeholder-image=""]`))

    expect(console.warn).toBeCalledWith(
      `[gatsby-plugin-image] You're missing out on some cool performance features. Please add "gatsby-plugin-image" to your gatsby-config.js`
    )
  })

  it(`shows nothing when the image props is not passed`, async () => {
    process.env.NODE_ENV = `development`
    // Allows to get rid of typescript error when not passing image
    // This is helpful for user using JavaScript and not getting advent of
    // TS types
    const GatsbyImageAny = GatsbyImage as React.FC
    const { container } = render(<GatsbyImageAny />)

    await waitFor(() => container.querySelector(`[data-placeholder-image=""]`))

    expect(console.warn).toBeCalledWith(
      `[gatsby-plugin-image] Missing image prop`
    )
    expect(container.firstChild).toBeNull()
  })

  it(`cleans up the DOM when unmounting`, async () => {
    ;(hooks as any).hasNativeLazyLoadSupport = false

    const { container, unmount } = render(
      <GatsbyImage image={image} alt="Alt content" />
    )

    await waitFor(() => container.querySelector(`[data-placeholder-image=""]`))

    unmount()

    expect(container).toMatchInlineSnapshot(`<div />`)
  })

  it(`does nothing on first server hydration`, async () => {
    // In this scenario,
    // hasSSRHtml is true and resolved through "beforeHydrationContent" and hydrate: true
    // hydrated.current is false and not resolved yet
    ;(hooks as any).hasNativeLazyLoadSupport = true

    const { container } = render(
      <GatsbyImage image={image} alt="Alt content" />,
      { container: beforeHydrationContent, hydrate: true }
    )

    const placeholder = await waitFor(() =>
      container.querySelector(`[data-placeholder-image=""]`)
    )
    const mainImage = container.querySelector(`[data-main-image=""]`)

    expect(placeholder).toBeDefined()
    expect(mainImage).toBeDefined()
  })

  it(`relies on native lazy loading when the SSR element exists and that the browser supports native lazy loading`, async () => {
    const onStartLoadSpy = jest.fn()
    const onLoadSpy = jest.fn()

    // In this scenario,
    // hasSSRHtml is true and resolved through "beforeHydrationContent" and hydrate: true
    ;(hooks as any).hasNativeLazyLoadSupport = true
    ;(hooks as any).storeImageloaded = jest.fn()

    const { container } = render(
      <GatsbyImage
        image={image}
        alt="Alt content"
        onStartLoad={onStartLoadSpy}
        onLoad={onLoadSpy}
      />,
      { container: beforeHydrationContent, hydrate: true }
    )

    const img = await waitFor(() =>
      container.querySelector(`[data-main-image=""]`)
    )

    img.dispatchEvent(new Event(`load`))

    expect(onStartLoadSpy).toBeCalledWith({ wasCached: false })
    expect(onLoadSpy).toBeCalled()
    expect(hooks.storeImageloaded).toBeCalledWith(
      `{"fallback":{"src":"some-src-fallback.jpg"}}`
    )
  })

  it(`relies on intersection observer when the SSR element is not resolved`, async () => {
    ;(hooks as any).hasNativeLazyLoadSupport = true
    const onStartLoadSpy = jest.fn()

    const { container } = render(
      <GatsbyImage
        image={image}
        alt="Alt content"
        onStartLoad={onStartLoadSpy}
      />
    )

    await waitFor(() => container.querySelector(`[data-main-image=""]`))

    expect(onStartLoadSpy).toBeCalledWith({ wasCached: false })
  })

  it(`relies on intersection observer when browser does not support lazy loading`, async () => {
    ;(hooks as any).hasNativeLazyLoadSupport = false
    const onStartLoadSpy = jest.fn()

    const { container } = render(
      <GatsbyImage
        image={image}
        alt="Alt content"
        onStartLoad={onStartLoadSpy}
      />,
      { container: beforeHydrationContent, hydrate: true }
    )

    await waitFor(() => container.querySelector(`[data-main-image=""]`))

    expect(onStartLoadSpy).toBeCalledWith({ wasCached: false })
  })
})
