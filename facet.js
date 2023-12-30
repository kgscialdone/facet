// Facet v0.1.1 | https://github.com/kgscialdone/facet

/** Facet Javascript API */
const facet = new function() {
  this.version = '0.1.1'

  /**
   * Define a Facet component. This is primarily for internal use; it can be called manually to define
   *  components in JS but the `<template component>` method should be preferred.
   * @param {string} tagName The kebab-case tag name of the new component.
   * @param {HTMLTemplateElement} template The `<template>` element to use for the component's content.
   * @param {Object} options Component options
   * @param {'open'|'closed'|'none'} [options.shadowMode='closed'] The shadow DOM mode to use (default: 'closed').
   * @param {string[]} [options.observeAttrs=[]] A list of attribute names to observe (default: []).
   * @param {string[]} [options.applyMixins=[]] A list of mixin names to include (default: []).
   * @param {{[name:string]:(host:FacetComponent,root:(FacetComponent|ShadowRoot),value:string)=>string}} [options.localFilters={}] An object containing local filter functions (default: {}).
   * @param {string} [options.extendsElement=] The tag name of the element type to extend if any (default: unset)
   * @param {boolean} [options.formAssoc=false] If true, treat this custom element as a form element (default: false)
   */
  this.defineComponent = function defineComponent(tagName, template, 
    { shadowMode = 'closed', observeAttrs = [], applyMixins = [], localFilters = {}, extendsElement, formAssoc = false }
  ) {
    const localMixins    = this.mixins.filter(m => m.applyGlobally || applyMixins.includes(m.name))
    const extendsConstr  = extendsElement ? document.createElement(extendsElement).constructor : HTMLElement
    const extendsOptions = extendsElement ? { extends: extendsElement } : undefined
    
    window.customElements.define(tagName, class FacetComponent extends extendsConstr {
      static observedAttributes = observeAttrs
      static formAssociated = formAssoc
      #root = shadowMode !== 'none' ? this.attachShadow({ mode: shadowMode }) : this
      #localFilters = {...localFilters}

      constructor() {
        super()
        
        // Setup form associated mode
        // This whole section is a mega kludge, but there isn't really a better way
        if(formAssoc) {
          let internals = this.attachInternals(), value
          Object.defineProperties(this, {
            internals: { value: internals, writable: false },
            value: { get: () => value, set: newValue => internals.setFormValue(value = newValue) },

            name: { get: () => this.getAttribute('name') },
            form: { get: () => internals.form },
            labels: { get: () => internals.labels },
            validity: { get: () => internals.validity },
            validationMessage: { get: () => internals.validationMessage },
            willValidate: { get: () => internals.willValidate },

            setFormValue: { value: (n,s) => internals.setFormValue(value = n, s), writable: false },
            setValidity: { value: internals.setValidity.bind(internals), writable: false },
            checkValidity: { value: internals.checkValidity.bind(internals), writable: false },
            reportValidity: { value: internals.reportValidity.bind(internals), writable: false }
          })
        }
      }
  
      connectedCallback() {
        const content = template.content.cloneNode(true)
        for(let mixin of localMixins) {
          content[mixin.attachPosition](mixin.template.content.cloneNode(true))
          Object.assign(this.#localFilters, mixin.localFilters)
        }
  
        // Attach <script on> event handlers
        for(let script of content.querySelectorAll('script[on]')) {
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
        for(let el of content.querySelectorAll('[inherit]')) {
          for(let attr of el.getAttribute('inherit').split(/\s+/g)) {
            const [,ogname,rename,fn] = attr.match(/^([^\/>"'=]+)(?:>([^\/>"'=]+))?(?:\/(\w+))?$/)
            const cv = this.getAttribute(ogname), filter = this.#localFilters[fn]?.bind(this, this, this.#root) ?? window[fn]
            if(cv) el.setAttribute(rename ?? ogname, filter?.(cv, undefined, el, this) ?? cv)

            if(observeAttrs.includes(ogname))
              this.addEventListener('attributeChanged', ({detail:{name, oldValue, newValue}}) => {
                if(name !== ogname) return
                el.setAttribute(rename ?? ogname, filter?.(newValue, oldValue, el, this) ?? newValue)
              })
          }
          el.removeAttribute('inherit')
        }

        if(formAssoc) this.value = this.getAttribute('value')
        this.#root.append(content)
        this.#event('connect')
      }
  
      disconnectedCallback()                             { this.#event('disconnect') }
      adoptedCallback()                                  { this.#event('adopt') }
      attributeChangedCallback(name, oldValue, newValue) { this.#event('attributeChanged', { name, oldValue, newValue }) }
      formAssociatedCallback(form)                       { this.#event('formAssociate', { form }) }
      formDisabledCallback(disabled)                     { this.#event('formDisable', { disabled }) }
      formResetCallback()                                { this.#event('formReset') }
      formStateRestoreCallback(state, mode)              { this.#event('formStateRestore', { state, mode }) }

      #event(n, d={}) { this.dispatchEvent(new CustomEvent(n, { detail: { ...d, component: this } })) }
    }, extendsOptions)
  }

  /**
   * Define a mixin which can be appended after the content of other components.
   * @param {string} name The name used to reference this mixin.
   * @param {HTMLTemplateElement} template The `<template>` element containing the mixin's content.
   * @param {Object} options Mixin options
   * @param {boolean} [options.applyGlobally=false] If true, automatically applies this mixin to all components (default: false).
   * @param {'prepend'|'append'} [options.attachPosition='append'] Determines whether to prepend or append the mixin's content (default: 'append').
   * @param {{[name:string]:(host:FacetComponent,root:(FacetComponent|ShadowRoot),value:string)=>string}} [options.localFilters={}] An object containing local filter functions (default: {}).
   */
  this.defineMixin = function defineMixin(name, template, options) {
    (this.mixins ??= []).push({ ...options, name, template })
  }

  /**
   * Discover and define `<template mixin>`s and `<template component>`s.
   * @param {ParentNode} root The parent element to discover inside.
   */
  this.discoverDeclarativeComponents = function discoverDeclarativeComponents(root) {
    let mixinSelector = `template[${facet.config.namespace}mixin]:not([defined])`
    let cmpntSelector = `template[${facet.config.namespace}component]:not([defined])`

    if(root.matches?.(mixinSelector)) processMixin(root)
    if(root.matches?.(cmpntSelector)) processComponent(root)
    for(let template of root.querySelectorAll(mixinSelector)) processMixin(template)
    for(let template of root.querySelectorAll(cmpntSelector)) processComponent(template)

    function processMixin(template) {
      template.setAttribute('defined',true)
      facet.defineMixin(template.getAttribute(`${facet.config.namespace}mixin`), template, {
        applyGlobally: template.hasAttribute('global'),
        attachPosition: template.hasAttribute('prepend') ? 'prepend' : 'append',
        localFilters: discoverLocalFilters(template),
      })
    }
    function processComponent(template) {
      template.setAttribute('defined',true)
      facet.defineComponent(template.getAttribute(`${facet.config.namespace}component`), template, {
        shadowMode: template.getAttribute('shadow')?.toLowerCase() ?? facet.config.defaultShadowMode,
        observeAttrs: template.getAttribute('observe')?.split(/\s+/g) ?? [],
        applyMixins: template.getAttribute('mixins')?.split(/\s+/g) ?? [],
        localFilters: discoverLocalFilters(template),
        extendsElement: template.getAttribute('extends'),
        formAssoc: template.hasAttribute('forminput'),
      })
    }
    function discoverLocalFilters(template) {
      return [...template.content.querySelectorAll('script[filter]')]
        .map(script => { script.remove(); return [script.getAttribute('filter'), new Function('host', 'root', 'value', script.innerText)] })
        .reduce((a,[k,v]) => { a[k] = v; return a }, {})
    }
  }

  /** Configuration options */
  this.config = {
    /** If set, prepends a namespace to the `component` and `mixin` magic attributes to reduce conflicts.
     *  (default: none, declarative: value of `namespace` attribute on importing script, or `facet-` if present with no value) */
    namespace: document.currentScript?.hasAttribute?.('namespace')
      ? document.currentScript.getAttribute('namespace') || 'facet-' : '',

    /** If true, automatically calls `facet.discoverDeclarativeComponents` on script load.
     *  (default: true, declarative: false if `libonly` attribute present on importing script) */
    autoDiscover: document.currentScript && !document.currentScript.hasAttribute('libonly'),

    /** Default shadow root mode for declaratively defined components.
     *  (default: 'closed', declarative: value of `shadow` attribute on importing script) */
    defaultShadowMode: document.currentScript?.getAttribute('shadow') ?? 'closed'
  }

  // Automatically discover Facet templates on load
  setTimeout(() => this.config.autoDiscover && this.discoverDeclarativeComponents(document))
}

