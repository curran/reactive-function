# reactive-function

A library for managing reactive data flows.

[![NPM](https://nodei.co/npm/reactive-function.png)](https://npmjs.org/package/reactive-function)
[![NPM](https://nodei.co/npm-dl/reactive-function.png?months=3)](https://npmjs.org/package/reactive-function)
[![Build Status](https://travis-ci.org/datavis-tech/reactive-function.svg?branch=master)](https://travis-ci.org/datavis-tech/reactive-function)

This library provides the ability to define reactive data flows by modeling application state as a directed graph and using [topological sorting](https://en.wikipedia.org/wiki/Topological_sorting) to compute the order in which changes should be propagated.

<p align="center">
  <img src="https://cloud.githubusercontent.com/assets/68416/15476439/82b83244-212c-11e6-91d5-d975de8b6b8a.png">
  <br>
  This library is built on top of <a href="https://github.com/datavis-tech/reactive-property">reactive-property</a> and <a href="https://github.com/datavis-tech/graph-data-structure">graph-data-structure</a>.
</p>

**Table of Contents**

 * [Examples](#examples)
   * [Full Name](#full-name)
   * [ABC](#abc)
   * [Tricky Case](#tricky-case)
   * [Ohm's Law](#ohms-law)
 * [Installing](#installing)
 * [API Reference](#api-reference)
   * [Managing Reactive Functions](#managing-reactive-functions)
   * [Data Flow Execution](#data-flow-execution)
   * [Serialization](#serialization)

## Examples

### Full Name
Suppose you have two reactive properties to represent someone's first and last name.

```javascript
var firstName = ReactiveProperty("Jane");
var lastName = ReactiveProperty("Smith");
```

Another reactive property can represent the full name of the person.

```javascript
var fullName = ReactiveProperty();
```

You could set the full name value like this.

```javascript
fullName(firstName() + " " + lastName());
```

However, the above code sets the value of `fullName` only once. Here's how you can define a **[ReactiveFunction](#constructor)** that automatically updates `fullName` whenever `firstName` or `lastName` change.

```javascript
var reactiveFunction = ReactiveFunction({
  inputs: [firstName, lastName],
  output: fullName,
  callback: function (first, last){
    return first + " " + last;
  }
});
```

<p align="center">
  <img src="https://cloud.githubusercontent.com/assets/68416/15389922/cf3f24dc-1dd6-11e6-92d6-058051b752ea.png">
  <br>
  The data flow graph for the example code above.
</p>

Whenever `firstName` or `lastName` change, the callback defined above will be executed on the next animation frame. If you don't want to wait until the next animation frame, you can force a synchronous evaluation of the data flow graph by invoking **[digest](#digest)**.

```javascript
ReactiveFunction.digest();
```

Now you can access the computed `fullName` value by invoking it as a getter.

```javascript
console.log(fullName()); // Prints "Jane Smith"
```

### ABC

The output of one reactive function can be used as an input to another.

<p align="center">
  <img src="https://cloud.githubusercontent.com/assets/68416/15385597/44a10522-1dc0-11e6-9054-2150f851db46.png">
  <br>
  Here, b is both an output and an input.
</p>

```javascript
var a = ReactiveProperty(5);
var b = ReactiveProperty();
var c = ReactiveProperty();

ReactiveFunction({
  inputs: [a],
  output: b,
  callback: function (a){ return a * 2; }
});

ReactiveFunction({
  inputs: [b],
  output: c,
  callback: function (b){ return b / 2; }
});

ReactiveFunction.digest();
assert.equal(c(), 5);
```

### Tricky Case

This is the case where [Model.js](https://github.com/curran/model) fails because it uses [Breadth-first Search](https://en.wikipedia.org/wiki/Breadth-first_search) to propagate changes. In this graph, propagation using breadth-first search would cause `e` to be set twice, and the first time it would be set with an *inconsistent state*. This fundamental flaw cropped up as flashes of inconstistent states in some interactive visualizations built on Model.js. For example, it happens when you change the X column in this [Magic Heat Map](http://bl.ocks.org/curran/a54fc3a6578efcdc19f4). This flaw in Model.js is the main inspiration for making this library and using [topological sort](https://en.wikipedia.org/wiki/Topological_sorting), which is the correct algorithm for propagating data flows and avoiding inconsistent states.

<p align="center">
  <img src="https://cloud.githubusercontent.com/assets/68416/15400254/7f779c9a-1e08-11e6-8992-9d2362bfba63.png">
  <br>
  The tricky case, where breadth-first propagation fails.
</p>

```javascript
var a = ReactiveProperty(5);
var b = ReactiveProperty();
var c = ReactiveProperty();
var d = ReactiveProperty();
var e = ReactiveProperty();

ReactiveFunction({ inputs: [a],    output: b, callback: function (a){    return a * 2; } });
ReactiveFunction({ inputs: [b],    output: c, callback: function (b){    return b + 5; } });
ReactiveFunction({ inputs: [a],    output: d, callback: function (a){    return a * 3; } });
ReactiveFunction({ inputs: [c, d], output: e, callback: function (c, d){ return c + d; } });

ReactiveFunction.digest();
assert.equal(e(), ((a() * 2) + 5) + (a() * 3));

a(10);
ReactiveFunction.digest();
assert.equal(e(), ((a() * 2) + 5) + (a() * 3));
```

### Ohm's Law

[Ohm's Law](https://en.wikipedia.org/wiki/Ohm%27s_law) is a mathematical relationship between 3 quantities in electrical circuits:

 * V, voltage. V = IR
 * I, current. I = V/R
 * R, resistance. R = V/I

Given any two of these values, one can calculate the third. Here's an example where if any two of the values are set, the third will automatically be calculated.

<p align="center">
  <img src="https://cloud.githubusercontent.com/assets/68416/15575699/db091b10-2371-11e6-9b0e-8c77878039f5.png">
  <br>
  The data flow graph for Ohm's Law.
</p>

```javascript
var I = ReactiveProperty();
var V = ReactiveProperty();
var R = ReactiveProperty();

ReactiveFunction({ output: V, inputs: [I, R], callback: function (i, r){ return i * r; } });
ReactiveFunction({ output: I, inputs: [V, R], callback: function (v, r){ return v / r; } });
ReactiveFunction({ output: R, inputs: [V, I], callback: function (v, i){ return v / i; } });

V(9)
I(2)
ReactiveFunction.digest();
console.log(R()); // Prints 4.5

R(6)
I(2)
ReactiveFunction.digest();
console.log(V()); // Prints 12

V(9);
R(18);
ReactiveFunction.digest();
console.log(I()); // Prints 0.5
```

For more detailed example code, have a look at the [tests](https://github.com/datavis-tech/reactive-function/blob/master/test.js).

## Installing

If you are using [NPM](npmjs.com), install this package with:

`npm install reactive-function`

Require it in your code like this:

```javascript
var ReactiveFunction = require("reactive-function");
```

This library is designed to work with [reactive-property](https://github.com/datavis-tech/reactive-property), you'll need that too.

`npm install reactive-property`

```javascript
var ReactiveProperty = require("reactive-property");
```

## API Reference

 * [Managing Reactive Functions](#managing-reactive-functions)
 * [Data Flow Execution](#data-flow-execution)
 * [Serialization](#serialization)

### Managing Reactive Functions

<a name="constructor" href="#constructor">#</a> <b>ReactiveFunction</b>(<i>options</i>)

Construct a new reactive function. The *options* argument should have the following properties.

 * *inputs* - The input properties. An array of **[ReactiveProperty](https://github.com/datavis-tech/reactive-property#constructor)** instances.
 * *output* (optional) - The output property. An instance of  **[ReactiveProperty](https://github.com/datavis-tech/reactive-property#constructor)**.
 * *callback* - The reactive function callback. Arguments are values of *inputs*. The return value will be assigned to *output*.

This constructor sets up a reactive function such that *callback* be invoked

 * when all input properties are defined,
 * after any input properties change,
 * during a **[digest](#digest)**.

An input property is considered "defined" if it has any value other than `undefined`. The special value `null` is considered to be defined.

An input property is considered "changed" when

 * the reactive function is initially set up, and
 * whenever its value is set.

Input properties for one reactive function may also be outputs of another.

<a name="destroy" href="#destroy">#</a> <i>reactiveFunction</i>.<b>destroy</b>()

Cleans up resources allocated to this reactive function.

More specifically:

 * Removes listeners from inputs.
 * Removes edges from the data flow graph (from each input).
 * Removes property nodes from the data flow graph if they have no incoming or outgoing edges.

You should invoke this function when finished using reactive functions in order to avoid memory leaks.

<a name="link" href="#link">#</a> <i>ReactiveFunction</i>.<b>link</b>(<i>propertyA</i>, <i>propertyB</i>)

Sets up one-way data binding from *propertyA* to *propertyB*. Returns an instance of **[ReactiveFunction](#constructor)**.

Arguments:

 * *propertyA* - A [reactive-property](https://github.com/datavis-tech/reactive-property). 
 * *propertyB* - A [reactive-property](https://github.com/datavis-tech/reactive-property) that will be set to the value of *propertyA* and updated whenever *propertyA* changes.

Example:

```javascript
var a = ReactiveProperty(5);
var b = ReactiveProperty(10);
var link = ReactiveFunction.link(a, b);
```

This is equivalent to:

```javascript
var a = ReactiveProperty(5);
var b = ReactiveProperty(10);
var link = ReactiveFunction({
  inputs: [a],
  output: b,
  callback: function (a){ return a; }
});
```

### Data Flow Execution

<a name="digest" href="#digest">#</a> ReactiveFunction.<b>digest</b>()

Propagates changes from input properties through the data flow graph defined by all reactive properties using [topological sorting](https://en.wikipedia.org/wiki/Topological_sorting). An edge in the data flow graph corresponds to a case where the output of one reactive function is used as an input to another.

Whenever any input properties for any reactive function change, **[digest](#digest)** is debounced (scheduled for invocation) on the  **[nextFrame](#next-frame)**. Because it is debounced, multiple synchronous changes to input properties collapse into a single digest invocation.

Digests are debounced to the next animation frame rather than the next tick because browsers will render the page at most every animation frame (approximately 60 frames per second). This means that if DOM manipulations are triggered by reactive functions, and input properties are changed more frequently than 60 times per second (e.g. mouse or keyboard events), the DOM manipulations will only occur at most 60 times per second, not more than that.

<a name="next-frame" href="#next-frame">#</a> ReactiveFunction.<b>nextFrame</b>(<i>callback</i>)

Schedules the given function to execute on the next animation frame or next tick.

This is a simple polyfill for [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame) that falls back to [setTimeout](https://developer.mozilla.org/en-US/docs/Web/API/WindowTimers/setTimeout). The main reason for having this is for use in the [tests](https://github.com/datavis-tech/reactive-function/blob/master/test.js), which run in a Node.js environment where `requestAnimationFrame` is not available. Automatic digests are debounced against this function.

### Serialization

<a name="serialize" href="#serialize">#</a> ReactiveFunction.<b>serializeGraph</b>()

Serializes the data flow graph. Returns an object with the following properties.

 * `nodes` An array of objects, each with the following properties.
   * `id` The node identifier string.
   * `propertyName` The property name for this node, derived from `property.propertyName` for each property.
 * `links` An array of objects representing edges, each with the following properties.
   * `source` The node identifier string of the source node (**u**).
   * `target` The node identifier string of the target node (**v**).

Example:

```javascript
var firstName = ReactiveProperty("Jane");
var lastName = ReactiveProperty("Smith");
var fullName = ReactiveProperty();

// For serialization.
firstName.propertyName = "firstName";
lastName.propertyName = "lastName";
fullName.propertyName = "fullName";

ReactiveFunction({
  inputs: [firstName, lastName],
  output: fullName,
  callback: function (first, last){
    return first + " " + last;
  }
});

var serialized = ReactiveFunction.serializeGraph();
```
The value of `serialized` will be:

```json
{
  "nodes": [
    { "id": "95", "propertyName": "fullName" },
    { "id": "96", "propertyName": "firstName" },
    { "id": "97", "propertyName": "lastName" }
  ],
  "links": [
    { "source": "96", "target": "95" },
    { "source": "97", "target": "95" }
  ]
}
```

See also:

 * <a href="https://github.com/datavis-tech/graph-data-structure#serialize"><i>graph</i>.<b>serialize</b>()</a>
 * [graph-diagrams](https://github.com/datavis-tech/graph-diagrams/)

## Related Work

 * [Functional Reactive Animation (academic paper)](https://www.eecs.northwestern.edu/~robby/courses/395-495-2009-winter/fran.pdf)
 * [ReactiveJS](https://github.com/mattbaker/Reactive.js)
 * [vogievetsky/DVL](https://github.com/vogievetsky/DVL)
 * [EmberJS Computed Properties](https://guides.emberjs.com/v2.0.0/object-model/computed-properties/)
 * [AngularJS Digest](https://docs.angularjs.org/api/ng/type/$rootScope.Scope#$digest)
 * [ZJONSSON/clues](https://github.com/ZJONSSON/clues)
 * [Model.js](https://github.com/curran/model)
 * [RxJS - when](https://github.com/Reactive-Extensions/RxJS/blob/master/doc/api/core/operators/when.md)
 * [Bacon - When](https://github.com/baconjs/bacon.js/tree/master#bacon-when)

<p align="center">
  <a href="https://datavis.tech/">
    <img src="https://cloud.githubusercontent.com/assets/68416/15298394/a7a0a66a-1bbc-11e6-9636-367bed9165fc.png">
  </a>
</p>
