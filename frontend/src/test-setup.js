// jsdom lacks several browser APIs the UI relies on.
class RO { observe() {} unobserve() {} disconnect() {} }
class IO { constructor(cb) { this.cb = cb } observe(el) { this.cb([{ isIntersecting: true, target: el }]) } unobserve() {} disconnect() {} takeRecords() { return [] } }
globalThis.ResizeObserver = globalThis.ResizeObserver || RO
globalThis.IntersectionObserver = IO
window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent() { return false } }))
window.scrollTo = () => {}
