// Facet v0.1.0 | https://github.com/kgscialdone/facet

/** Facet Javascript API */
const facet = new function() {
  const mixins = {}, globalMixins = []
  const $ = (s,...v) => String.raw({raw:s},...v)+(facet.config.useNamespace?'[facet]':'')

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
  this.defineComponent = function defineComponent(tagName, template, { shadowMode = 'closed', observeAttrs = [], applyMixins = [] }) {
    const localMixins = new Set(applyMixins.concat(globalMixins).map(m=>mixins[m]))
  
    window.customElements.define(tagName, class FacetComponent extends HTMLElement {
      static observedAttributes = observeAttrs
      #root = shadowMode.toLowerCase() !== 'none' ? this.attachShadow({ mode: shadowMode.toLowerCase() }) : this
  
      connectedCallback() {
        const content = template.content.cloneNode(true)
        for(let mixin of localMixins) content[mixin.attachPosition](mixin.template.content.cloneNode(true))
  
        // Attach <script on> event handlers
        for(let script of content.querySelectorAll($`script[on]`)) {
          let parent = script.parentElement ?? this
          let handler = new Function('host', 'root', 'event', script.innerText).bind(parent, this, this.#root)
          for(let event of script.getAttribute('on').split(/\s+/g)) 
            parent.addEventListener(event, handler, {
              once: script.hasAttribute('once'),
              capture: script.hasAttribute('capture'),
              ...(script.hasAttribute('passive') ? { passive: true } : {}) // Respect inconsistent browser defaults
            })
          script.remove()
        }
  
        // Mirror inherited variables and attach syncing event handlers to observed inherited variables
        for(let el of content.querySelectorAll($`[inherit]`)) {
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
  }

  /**
   * Define a mixin which can be appended after the content of other components.
   * @param {string} name The name used to reference this mixin.
   * @param {HTMLTemplateElement} template The `<template>` element containing the mixin's content.
   * @param {Object} options Mixin options
   * @param {boolean} [options.applyGlobally=false] If true, automatically applies this mixin to all components (default: false).
   * @param {'prepend'|'append'} [options.attachPosition='append'] Determines whether to prepend or append the mixin's content (default: 'append').
   */
  this.defineMixin = function defineMixin(name, template, { applyGlobally = false, attachPosition = 'append' }) {
    mixins[name] = { template, attachPosition } 
    if(applyGlobally) globalMixins.push(name)
  }

  /**
   * Discover and define `<template mixin>`s and `<template component>`s.
   * @param {ParentNode} root The parent element to discover inside.
   */
  this.discoverDeclarativeComponents = function discoverDeclarativeComponents(root) {
    for(let template of root.querySelectorAll($`template[mixin]`))
      this.defineMixin(template.getAttribute('mixin'), template, {
        applyGlobally: template.hasAttribute('global'),
        attachPosition: template.hasAttribute('prepend') ? 'prepend' : 'append'
      })

    for(let template of root.querySelectorAll($`template[component]`))
      this.defineComponent(template.getAttribute('component'), template, {
        shadowMode: template.getAttribute('shadow') ?? facet.config.defaultShadowMode,
        observeAttrs: template.getAttribute('observe')?.split(/\s+/g) ?? [],
        applyMixins: template.getAttribute('mixins')?.split(/\s+/g) ?? []
      })
  }

  /** Configuration options */
  this.config = {
    /** If true, adds a check for the `facet` attribute to all selector queries.
     *  (default: false, declarative: true if `namespace` attribute present on importing script) */
    useNamespace: !!document.currentScript?.hasAttribute?.('namespace'),

    /** If true, automatically calls `facet.discoverDeclarativeComponents` on script load.
     *  (default: true, declarative: false if `libonly` attribute present on importing script) */
    autoDiscover: document.currentScript && !document.currentScript.hasAttribute('libonly'),

    /** Default shadow root mode for declaratively defined components.
     *  (default: 'closed', declarative: value of `shadow` attribute on importing script) */
    defaultShadowMode: document.currentScript?.getAttribute('shadow') ?? 'closed'
  }

  // Automatically discover Facet templates on load
  ;(fn => document.readyState === 'interactive' ? fn() : document.addEventListener('DOMContentLoaded', fn, {once:true}))
   (() => this.config.autoDiscover && this.discoverDeclarativeComponents(document))
}

