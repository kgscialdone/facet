// Facet v0.1.0
// https://github.com/katrinakitten/facet

/** Facet Javascript API */
const facet = {
  /**
   * Define a Facet component. This is primarily for internal use; it can be called manually to define
   *  components in JS but the `<template component>` method should be preferred.
   * @param {string} tagName The kebab-case tag name of the new component.
   * @param {HTMLTemplateElement} template The `<template>` element to use for the component's content.
   * @param {Object} options Component options
   * @param {'open'|'closed'|'none'} [options.shadowMode='closed'] The shadow DOM mode to use (default: 'closed').
   * @param {string[]} [options.observeAttrs=[]] A list of attribute names to observe (default: []).
   * @param {string[]} [options.applyMixins=[]] A list of mixin names to include (default: []).
   */
  defineComponent(tagName, template, { shadowMode = 'closed', observeAttrs = [], applyMixins = [] }) {
    const mixins = new Set(applyMixins.concat(facet._.globalMixins).map(m=>facet._.mixins[m]).filter(x=>x))
  
    window.customElements.define(tagName, class FacetComponent extends HTMLElement {
      static observedAttributes = observeAttrs
      #root = shadowMode.toLowerCase() !== 'none' ? this.attachShadow({ mode: shadowMode.toLowerCase() }) : this
  
      connectedCallback() {
        const content = template.content.cloneNode(true)
        for(let mixin of mixins) content.append(mixin.content.cloneNode(true))
  
        // Attach <script on> event handlers
        for(let script of content.querySelectorAll(facet._.sel('script[on]'))) {
          let parent = script.parentElement ?? this
          let handler = new Function('host', 'root', 'event', script.innerText).bind(parent, this, this.#root)
          for(let event of script.getAttribute('on').split(/\s+/g)) parent.addEventListener(event, handler)
          script.remove()
        }
  
        // Mirror inherited variables and attach syncing event handlers to observed inherited variables
        for(let el of content.querySelectorAll(facet._.sel('[inherit]'))) {
          for(let attr of el.getAttribute('inherit').split(/\s+/g)) {
            const [,ogname,rename,fn] = attr.match(/^([^\/>"'=]+)(?:>([^\/>"'=]+))?(?:\/(\w+))?$/)
            const cv = this.getAttribute(ogname), filter = window[fn]
            if(cv) el.setAttribute(rename ?? ogname, filter?.(cv, undefined, el, this) ?? cv)

            if(observeAttrs.includes(ogname))
              this.addEventListener('attributeChanged', ({detail:{name, oldValue, newValue}}) => {
                if(name !== ogname) return
                el.setAttribute(rename ?? ogname, filter?.(newValue, oldValue, el, this) ?? newValue)
              })
          }
          el.removeAttribute('inherit')
        }
  
        this.#root.append(content)
        this.#event('connect')
      }
  
      disconnectedCallback() { this.#event('disconnect') }
      adoptedCallback()      { this.#event('adopt') }
      attributeChangedCallback(name, oldValue, newValue) { this.#event('attributeChanged', { name, oldValue, newValue }) }
      #event(n, d={}) { this.dispatchEvent(new CustomEvent(n, { detail: { ...d, component: this } })) }
    })
  },

  /**
   * Define a mixin which can be appended after the content of other components.
   * @param {string} name The name used to reference this mixin.
   * @param {HTMLTemplateElement} template The `<template>` element containing the mixin's content.
   * @param {boolean} applyGlobally If true, automatically applies this mixin to all components (default: false).
   */
  defineMixin(name, template, applyGlobally=false) {
    facet._.mixins[name] = template
    if(applyGlobally) facet._.globalMixins.push(name)
  },

  /**
   * Discover and define `<template mixin>`s and `<template component>`s.
   * @param {ParentNode} root The parent element to discover inside.
   */
  discoverDeclarativeComponents(root) {
    for(let template of root.querySelectorAll(facet._.sel('template[mixin]')))
      facet.defineMixin(template.getAttribute('mixin'), template, template.hasAttribute('global'))

    for(let template of root.querySelectorAll(facet._.sel('template[component]')))
      facet.defineComponent(template.getAttribute('component'), template, {
        shadowMode: template.getAttribute('shadow') ?? 'closed',
        observeAttrs: template.getAttribute('observe')?.split(/\s+/g) ?? [],
        applyMixins: template.getAttribute('mixins')?.split(/\s+/g) ?? []
      })
  },

  /**
   * Wrap an HTML string in a `<template>` element.
   * @param {string} content The content.
   * @returns {HTMLTemplateElement}
   */
  createTemplateElement(content) {
    const template = document.createElement('template')
    template.innerHTML = content
    return template
  },

  /** Configuration options */
  config: {
    /** If true, adds a check for the `facet` attribute to all selector queries.
     *  (default: false, declarative: true if `namespace` attribute present on importing script) */
    useNamespace: !!document.currentScript?.hasAttribute?.('namespace'),

    /** If true, automatically calls `facet.discoverDeclarativeComponents` on script load.
     *  (default: true, declarative: false if `libonly` attribute present on importing script) */
    autoDiscover: document.currentScript && !document.currentScript.hasAttribute('libonly')
  },

  /** Internal use only */
  _: {
    /** @type {{[name: string]: HTMLTemplateElement}} */
    mixins: {}, 
    /** @type {string[]} */
    globalMixins: [],
    /** @type {(string) => string} */
    sel: s => facet.config.useNamespace ? s+'[facet]' : s
  }
}

// Automatically discover Facet templates on load
if(facet.config.autoDiscover) 
  (fn => document.readyState === 'interactive' ? fn() : document.addEventListener('DOMContentLoaded', fn, {once:true}))
  (() => facet.discoverDeclarativeComponents(document.body))