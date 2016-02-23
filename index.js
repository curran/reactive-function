var ReactiveProperty = require("./reactive-property.js");
var Graph = require("./graph-data-structure.js");

var errors = {
  notASetter: Error("You cannot set the value of a reactive function directly.")
};

// The singleton data dependency graph.
// Nodes are reactive properties and reactive functions.
// Edges represent dependencies of reactive functions.
var graph = Graph();

// This object accumulates nodes that have changed.
// Keys are node ids, values are truthy (the object acts like a Set).
var changedNodes = {};


// A lookup table for properties based on their assigned id.
var propertiesById = {};

// Looks up a property by its id.
function lookup(id){ return propertiesById[id]; }

// Assigns ids to properties for use as nodes in the graph.
var assignId = (function(){
  var idCounter = 1;
  return function (property){
    if(!property.id){
      property.id = idCounter++;
      propertiesById[property.id] = property;
    }
  };
}());

// Gets a property value.
function get(property){ return property(); }

//ReactiveFunction(dependencies... , callback)
function ReactiveFunction(){
  var dependencies = Array.apply(null, arguments);
  var callback = dependencies.pop();
  var value;

  var reactiveFunction = function (){
    if(arguments.length > 0){ throw errors.notASetter; }
    return value;
  };

  reactiveFunction.evaluate = function (){
    value = callback.apply(null, dependencies.map(get));
  };

  assignId(reactiveFunction);
  dependencies.forEach(function (dependency){
    assignId(dependency);
    graph.addEdge(dependency.id, reactiveFunction.id);
  });

  var properties = dependencies
    .filter(function (dependency){
      return dependency.on;
    });

  var listeners = properties
    .map(function (property){
      return property.on(function (){
        changedNodes[property.id] = true;
        queueDigest();
      });
    });

  reactiveFunction.destroy = function (){

    // TODO test
    listeners.forEach(function (listener, i){
      properties[i].off(listener);
    });

    // TODO test
    dependencies.forEach(function (dependency){
      graph.removeEdge(dependency.id, reactiveFunction.id);
    });

  };

  return reactiveFunction;
}

ReactiveFunction.digest = function (){
  graph
    .topologicalSort(Object.keys(changedNodes))
    .map(lookup)
    .forEach(function (reactiveFunction){
      reactiveFunction.evaluate();
    });
  changedNodes = {};
};

var queueDigest = debounce(ReactiveFunction.digest);

function debounce(fn){
  var queued = false;
  return function () {
    if(!queued){
      queued = true;
      setTimeout(function () {
        queued = false;
        fn();
      }, 0);
    }
  };
};


// TESTS /////////////////////////////////////////////////////////////////////
var assert = require("assert");

// Should depend on two reactive properties.
var a = ReactiveProperty(5);
var b = ReactiveProperty(10);

var c = ReactiveFunction(a, b, function (a, b){
  return a + b;
});

ReactiveFunction.digest();

assert.equal(c(), 15);


// Should depend on any number of reactive properties.
var a = ReactiveProperty(5);
var b = ReactiveProperty(10);
var c = ReactiveProperty(15);

var d = ReactiveFunction(a, function (a){ return a * 2; });
var e = ReactiveFunction(a, b, c, function (a, b, c){ return a + b + c; });

ReactiveFunction.digest();

assert.equal(d(), 10);
assert.equal(e(), 30);


// Should depend on a reactive function.
var a = ReactiveProperty(5);
var b = ReactiveFunction(a, function (a){ return a * 2; });
var c = ReactiveFunction(b, function (b){ return b / 2; });
ReactiveFunction.digest();
assert.equal(c(), 5);


// Should depend on a reactive property and a reactive function.
var a = ReactiveProperty(5);
var b = ReactiveProperty(10);
var c = ReactiveFunction(a, function (a){ return a * 2; });
var d = ReactiveFunction(b, c, function (b, c){ return b + c; });
ReactiveFunction.digest();
assert.equal(d(), 20);


// Should handle tricky case.
//      a
//     / \
//    b   |
//    |   d
//    c   |
//     \ /
//      e   
var a = ReactiveProperty(5);
var b = ReactiveFunction(a, function (a){ return a * 2; });
var c = ReactiveFunction(b, function (b){ return b + 5; });
var d = ReactiveFunction(a, function (a){ return a * 3; });
var e = ReactiveFunction(c, d, function (c, d){ return c + d; });
ReactiveFunction.digest();
assert.equal(e(), ((a() * 2) + 5) + (a() * 3));


// Should throw an error if attempting to set the value directly.
var a = ReactiveProperty(5);
var b = ReactiveFunction(a, function (a){ return a * 2; });
try{
  b(5);
} catch (err){
  console.log("Error thrown correctly.");
}


// Should clear changed nodes on digest.
var numInvocations = 0;
var a = ReactiveProperty(5);
var b = ReactiveFunction(a, function (a){
  numInvocations++;
  return a * 2;
});
ReactiveFunction.digest();
ReactiveFunction.digest();
assert.equal(numInvocations, 1);


// Should automatically digest on next tick.
var a = ReactiveProperty(5);
var b = ReactiveProperty(10);

var c = ReactiveFunction(a, b, function (a, b){
  return a + b;
});

setTimeout(function (){
  assert.equal(c(), 15);
  //done();
}, 0);

