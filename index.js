var ReactiveProperty = require("reactive-property");
var Graph = require("graph-data-structure");

// Use requestAnimationFrame if it is available.
// Otherwise fall back to setTimeout.
var nextFrame = setTimeout;
if(typeof requestAnimationFrame !== 'undefined') {
  nextFrame = requestAnimationFrame;
}

// The singleton data dependency graph.
// Nodes are reactive properties.
// Edges are dependencies between reactive function inputs and outputs.
var graph = Graph();

// A map for looking up properties based on their assigned id.
// Keys are property ids, values are reactive properties.
var properties = {};

// This object accumulates properties that have changed since the last digest.
// Keys are property ids, values are truthy (the object acts like a Set).
var changed = {};

// Assigns an id to a reactive property so it can be a node in the graph.
// Also stores a reference to the property by id in `properties`.
// If the given property already has an id, does nothing.
var assignId = (function(){
  var counter = 1;
  return function (property){
    if(!property.id){
      property.id = String(counter++);
      properties[property.id] = property;
    }
  };
}());

// The reactive function constructor.
// Accepts an options object with
//  * inputs - An array of reactive properties.
//  * callback - A function with arguments corresponding to values of inputs.
//  * output - A reactive property (optional).
function ReactiveFunction(options){

  var inputs = options.inputs;
  var callback = options.callback;
  var output = options.output;

  if(!defined(inputs)){
    throw new Error("Attempting to use an undefined property as a reactive function input.");
  }
  
  if(!output){
    output = function (){};
    output.propertyName = "";
  }

  // This gets invoked during a digest, after inputs have been evaluated.
  output.evaluate = function (){

    // Get the values for each of the input reactive properties.
    var values = inputs.map(function (input){
      return input();
    });

    // If all input values are defined,
    if(defined(values)){

      // invoke the callback and assign the output value.
      output(callback.apply(null, values));
    }

  };

  // Assign node ids to inputs and output.
  assignId(output);
  inputs.forEach(assignId);

  // Set up edges in the graph from each input.
  inputs.forEach(function (input){
    graph.addEdge(input.id, output.id);
  });

  // Add change listeners to each input property.
  // These mark the properties as changed and queue the next digest.
  var listeners = inputs.map(function (property){
    return property.on(function (){
      changed[property.id] = true;
      queueDigest();
    });
  });

  // Return an object that can destroy the listeners and edges set up.
  return {

    // This function must be called to explicitly destroy a reactive function.
    // Garbage collection is not enough, as we have added listeners and edges.
    destroy: function (){

      // Remove change listeners from inputs.
      listeners.forEach(function (listener, i){
        inputs[i].off(listener);
      });

      // Remove the edges that were added to the dependency graph.
      inputs.forEach(function (input){
        graph.removeEdge(input.id, output.id);
      });

      // Remove property nodes with no edges connected.
      inputs.concat([output]).forEach(function (property){
        var node = property.id;
        if(graph.indegree(node) + graph.outdegree(node) === 0){
          graph.removeNode(property.id);
        }
      });

      // Remove the reference to the 'evaluate' function.
      delete output.evaluate;

      // Remove references to everything.
      inputs = callback = output = undefined;
    }
  };
}

// Propagates changes through the dependency graph.
ReactiveFunction.digest = function (){
  var changedIds = Object.keys(changed);
  changed = {};
  graph
    .topologicalSort(changedIds, false)
    .map(function (id){
      return properties[id];
    })
    .forEach(function (property){
      property.evaluate();
    });
  changed = {};
};

// This function queues a digest at the next tick of the event loop.
var queueDigest = debounce(ReactiveFunction.digest);

// Returns a function that, when invoked, schedules the given function
// to execute once on the next frame.
// Similar to http://underscorejs.org/#debounce
function debounce(callback){
  var queued = false;
  return function () {
    if(!queued){
      queued = true;
      nextFrame(function () {
        queued = false;
        callback();
      }, 0);
    }
  };
}

// Returns true if all elements of the given array are defined.
function defined(arr){
  return !arr.some(isUndefined);
}

// Returns true if the given object is undefined.
// Returns false if the given object is some value, including null.
// Inspired by http://ryanmorr.com/exploring-the-eternal-abyss-of-null-and-undefined/
function isUndefined(obj){
  return obj === void 0;
}

ReactiveFunction.nextFrame = nextFrame;

ReactiveFunction.serializeGraph = function (){
  var serialized = graph.serialize();

  // Add property names.
  serialized.nodes.forEach(function (node){
    var propertyName = properties[node.id].propertyName;
    if(typeof propertyName !== "undefined"){
      node.propertyName = propertyName;
    }
  });

  return serialized;
}

ReactiveFunction.link = function (propertyA, propertyB){
  return ReactiveFunction({
    inputs: [propertyA],
    output: propertyB,
    callback: function (x){ return x; }
  });
}

module.exports = ReactiveFunction;
