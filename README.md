<img src="https://facet.unmodernweb.com/assets/facet-light.png" style="width:300px" alt="Facet">

Facet is a single-file web library that allows for the easy, declarative definition of [web components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components). By making use of `<template>` elements with special attributes, Facet makes it possible to define useful and effective web components with no Javascript boilerplate, so you can focus entirely on the structure and behavior of your component.

> _Like what you see? [Consider buying me a coffee](https://ko-fi.com/kgscialdone)_ 💜 

## Installation
You can download `facet.min.js` from this repository and reference it locally, or retrieve it directly from a CDN like JSDelivr. Facet will automatically detect component definitions in your page's HTML and convert them into web components.
```html
<script src="https://cdn.jsdelivr.net/gh/kgscialdone/facet@0.1.2a/facet.min.js"></script>
```

## Defining Components
Facet components are defined with `<template component>` elements, which will be automatically detected when the page loads. Facet uses the browser's [custom elements API](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements) internally, so Facet components are treated just like normal HTML elements.
```html
<template component="hello-world">
  <p>Hello, <slot>world</slot>!</p>
</template>

<hello-world></hello-world>
<hello-world>Facet</hello-world> <!-- replaces "world" with "Facet" -->
```

By default, Facet components use the [shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) in `closed` mode. You can adjust this with the `shadow` attribute, which accepts `open`, `closed`, or `none`.
```html
<template component="hello-world" shadow="none">
  <p>Hello, world!</p>
</template>
```

You can also define a list of attributes to be observed by the component; any attributes defined here will trigger the component's `attributeChanged` event when changed, allowing your code to respond to the update. (See [Attaching Behavior](#attaching-behavior) for details on `<script on>`.)
```html
<template component="observed-attrs" observe="name title">
  <script on="attributeChanged">console.log(event.detail.name)</script>
</template>
```

## Inherited Attributes
In many cases, it's beneficial to be able to define attributes where a component is used, and have those attributes change the behavior of elements inside the component. Facet achieves this through inherited attributes, which make copying attributes deeper into your components quick and easy.
```html
<template component="labeled-input">
  <label inherit="name>for required"><slot>Input</slot></label>
  <input inherit="name>id type value required placeholder">
</template>

<labeled-input name="email" type="email" required>Email</labeled-input>
```

When inheriting attributes, you can use them as-is, rename them, filter them through a Javascript function, or both:
```html
<p inherit="title">Lorem ipsum dolor sit amet...</p>
<p inherit="label>title">Lorem ipsum dolor sit amet...</p>
<p inherit="title/uppercase">Lorem ipsum dolor sit amet...</p>
<p inherit="label>title/uppercase">Lorem ipsum dolor sit amet...</p>

<script>
  function uppercase(string) { return string.toUpperCase() }
</script>

<!-- Or define your filter functions inside your component like this! -->
<!-- They'll be scoped to just that component and won't conflict with anything else. -->
<script filter="uppercase">
  return value.toUpperCase()
</script>
```

In addition, attributes that are both observed and inherited will automatically update whenever the component's attribute is changed:
```html
<template component="observe-inherit" observe="div-style">
  <div inherit="div-style>style"></div>
</template>

<!-- Changing the div-style attribute will automatically update the inner <div>'s styles! -->
<observe-inherit div-style="width:100%;height:100%;background:rebeccapurple;"></observe-inherit>
```

## Attaching Behavior
Since Facet components are defined entirely in HTML, you don't have the opportunity to edit the component class directly to add your behavior. Instead, Facet searches for `<script on>` elements inside of component definitions, and attaches their contents to their parent elements as event handlers.
```html
<template component="immediate-alert">
  <script on="connect">alert("You've been alerted immediately!")</script>
</template>
```

Event handler scripts don't have to be at the top level of the component; they'll be attached to whatever their parent element is, allowing you to easily define complex behaviors for any part of your component.
```html
<template component="click-alert">
  <button> <!-- Click handler will be attached here!-->
    Alert me!
    <script on="click">alert("I've been clicked!")</script>
  </button>
</template>
```

Facet exposes components' lifecycle hooks as custom events, which works hand in hand with event handler scripts to allow flexible, easy definition of custom behavior.

| Component Class Function   | Facet Event        | `event.detail`                            |
| :------------------------- | :----------------- | :---------------------------------------- |
| `connectedCallback`        | `connect`          | `{ component }`                           |
| `disconnectedCallback`     | `disconnect`       | `{ component }`                           |
| `adoptedCallback`          | `adopt`            | `{ component }`                           |
| `attributeChangedCallback` | `attributeChanged` | `{ component, name, newValue, oldValue }` |

In addition, event handler scripts have access to a small handful of magic variables, in a similar way to the `onclick` event handler attribute family.

| Magic Variable | Description
| :------------- | :--
| `this`         | The element to which the handler script is attached (parent element).
| `host`         | The host component.
| `root`         | The host component's shadow root (or the host component if `shadow="none"`).
| `event`        | The event that triggered the handler.

You can also adjust how event handler scripts act with the `once`, `capture`, and `passive` attributes, which correspond to their respective equivalents in [`addEventListener`'s `options` parameter](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#options). If the attribute is present, the corresponding option will be set to `true`, otherwise it will follow the browser defaults.

## Mixins
Facet also provides a mixin system in order to facilitate code reuse between similar components. Like components, mixins are defined with `<template>` elements, and their contents are appended to the shadow DOM of any component they're mixed into.
```html
<template mixin="alert">
  <script on="connect">alert("Connected!")</script>
</template>

<template component="hello-world" mixins="alert">
  <p>Hello, <slot>world</slot>!</p>
</template>
<template component="goodbye-world" mixins="alert">
  <p>Goodbye, <slot>world</slot>...</p>
</template>

<hello-world></hello-world> <!-- alerts on connect -->
<goodbye-world></goodbye-world> <!-- alerts on connect -->
```

Mixins with the `global` attribute will be automatically applied to all components on a page.
```html
<!-- Now every component will alert on connect! -->
<template mixin="alert" global>
  <script on="connect">alert("Connected!")</script>
</template>
```

Mixins with the `prepend` attribute will prepend their contents instead of appending them.
```html
<template mixin="lorem" prepend>Lorem ipsum dolor sit amet...</template>

<template component="prepended-mixins" mixin="lorem">
  is a pretty weird choice of filler text, if you think about it.
</template>
```

## Advanced Features
You can define [customized built-in elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements#customized_built-in_elements) with the `extends` attribute.
```html
<template component="lorem-ipsum" extends="p">
  Lorem ipsum dolor sit amet... <slot></slot>
</template>

<p is="lorem-ipsum">is a pretty weird choice of filler text, if you think about it.</p>
```

You can define [form-associated custom elements](https://web.dev/articles/more-capable-form-controls) with the `forminput` attribute.
```html
<template component="inc-dec" forminput>
  <script on="connect" once>host.innerText = host.value</script>
  <button>+ <script on="click">host.innerText = ++host.value</script></button>
  <span><slot></slot></span>
  <button>- <script on="click">host.innerText = --host.value</script></button>
</template>

<inc-dec value="0"></inc-dec>
```

## Configuration Options
While Facet's defaults are designed to serve the majority of use cases out of the box, it does have a small handful of configuration options, which can be adjusted via attributes on the `<script>` tag that imports the Facet library.

### Namespacing
Requires a prefix on the `component` and `mixin` attributes to help avoid conflicts. The prefix defaults to `facet-` if no value is supplied to the attribute.
```html
<!-- With default prefix -->
<script src="facet.min.js" namespace></script>

<template facet-component="hello-world">
  <p>Hello, <slot>world</slot>!</p>
  <script on="connect">console.log(this)</script>
</template>

<!-- With custom prefix -->
<script src="facet.min.js" namespace="fc-"></script>

<template fc-component="hello-world">
  <p>Hello, <slot>world</slot>!</p>
  <script on="connect">console.log(this)</script>
</template>
```

### Disable Automatic Discovery
Prevents the automatic discovery of component and mixin definitions, requiring you to manually call `facet.discoverDeclarativeComponents` yourself.
```html
<script src="facet.min.js" libonly></script>
<script defer>facet.discoverDeclarativeComponents(document)</script>
```

### Default Shadow Mode
Changes the default shadow root mode for new components. Equivalent to the `shadow` attribute on individual components.
```html
<script src="facet.min.js" shadow="none"></script>
```

## Javascript API
While Facet strives to never require you to write Javascript for any of its core behavior, it does expose its internal workings as a basic Javascript API. Facet's API is intentionally not perfectly ergonomic, since the declarative `<template>`-based interface described above is always the intended use case, but there are some things that can only be realistically achieved with Javascript, such as single-file importable components.

| Function | Description
| :------- | :--
| `facet.defineComponent(tagName, template, options)` | Define a new component.
| `facet.defineMixin(name, template, options)`        | Define a new mixin.
| `facet.discoverDeclarativeComponents(root)`         | Find and define all components and mixins in a given parent element.

| Variable | Description
| :------- | :--
| `facet.config.namespace`         | The required namespace prefix for the `component` and `mixin` attributes.
| `facet.config.autoDiscover`      | If false, skip automatic discovery of components/mixins on page load.
| `facet.config.defaultShadowMode` | The default shadow root mode for new components.
| `facet.mixins`                   | Information about all currently defined mixins.

Facet's source code is also lovingly commented with [JSDoc](https://jsdoc.app/), which keeps it lightweight and build-step free while still enabling Typescript users to rest easy about type safety when interacting with Facet's API.

## Reviews
> ⭐⭐⭐⭐⭐ "Anyone exploring web components really would do themselves a major favor giving this a solid look."
> 
> ⭐⭐⭐⭐⭐ "Facet is the first time I've looked at WebComponents and thought 'oh, I get this, I get what it's for'."
>
> ⭐⭐⭐⭐⭐ "This is exactly what I thought web components should be."
>
> ⭐⭐⭐⭐⭐ "Holy f\*\*\*, this is awesome!"
>
> ⭐⭐⭐⭐⭐ "I never thought much of web components but this really changes my view."

<sub>* All reviews are real quotes from users, but are used here in jest and with permission.</sub>

## Sponsors
Thank you so much to these $5/mo+ sponsors for your support!

- [Morgan Murrah](https://github.com/airbr) ($5/mo)
