function Node(type, key, text) {
	if (!(this instanceof Node))
		return new Node(type, key, text);

	this.type = type;
	this.key = key || type;
	this.text = text || key || type;
}

Node.prototype.toString = function() {
	return this.text;
};

Node.prototype.toConstructionString = function() {
  var key = quoteIfString(this.key);
  var text = quoteIfString(this.text);

  return this.constructor.name + "('" + this.type + "', " + key + ", "
        + text + ")";
}

function Refprop(type, key, text) {
  if (!(this instanceof Refprop))
    return new Refprop(type, key, text);

  Node.call(this, type, key, text);
}

Refprop.prototype = Object.create(Node.prototype);
Refprop.prototype.toString = function() {
  return this.text.substring(1);
}
Refprop.prototype.toConstructionString = function() {
  var key = quoteIfString(this.key);
  var text = quoteIfString(this.text);
  return "Refprop('" + this.type + "', " + key + ", " + text + ")";
}

function PctArg(type, key, text) {
  if (!(this instanceof PctArg))
    return new PctArg(type, key, text);

  Node.call(this, type, key, text);
}
PctArg.prototype = Object.create(Node.prototype);
PctArg.prototype.toString = function() {
  var num = this.key - 1;
  return "arguments[" + num + "]";
}

function quoteIfString(item) {
  if (typeof item === 'string') {
    item = item.replace(/"/g, '\\"');
    return '"' + item + '"';
  }
  return item;
}

function first(arr) {
	return arr[0];
}

function last(arr) {
	return arr[arr.length - 1];	
}

function rest(arr, n) {
	if (!n) n = 1;
	var result = [];
	for (var i = n; i < arr.length; ++i) {
		result.push(arr[i]);
	}

	return result;
}

if (!Function.prototype.bind) {
  Function.prototype.bind = function (oThis) {
    if (typeof this !== "function") {
      // closest thing possible to the ECMAScript 5 internal IsCallable function
      throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
    }

    var aArgs = Array.prototype.slice.call(arguments, 1), 
        fToBind = this, 
        fNOP = function () {},
        fBound = function () {
          return fToBind.apply(this instanceof fNOP && oThis
                                 ? this
                                 : oThis,
                               aArgs.concat(Array.prototype.slice.call(arguments)));
        };

    fNOP.prototype = this.prototype;
    fBound.prototype = new fNOP();

    return fBound;
  };
}

if (!Array.prototype.some) {
  Array.prototype.some = function(fun /*, thisp */) {
    'use strict';

    if (this == null) {
      throw new TypeError();
    }

    var thisp, i,
        t = Object(this),
        len = t.length >>> 0;
    if (typeof fun !== 'function') {
      throw new TypeError();
    }

    thisp = arguments[1];
    for (i = 0; i < len; i++) {
      if (i in t && fun.call(thisp, t[i], i, t)) {
        return true;
      }
    }

    return false;
  };
}

if (!Array.prototype.forEach) {
    Array.prototype.forEach = function (fn, scope) {
        'use strict';
        var i, len;
        for (i = 0, len = this.length; i < len; ++i) {
            if (i in this) {
                fn.call(scope, this[i], i, this);
            }
        }
    };
}