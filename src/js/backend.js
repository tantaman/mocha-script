function JsBackend() {

}

JsBackend.prototype = {

};

function List() {
  var arr = [ ];
  arr.push.apply(arr, arguments);
  arr.__proto__ = List.prototype;
  return arr;
}
List.prototype = new Array;
List.prototype.last = function() {
  return this[this.length - 1];
};
List.prototype.first = function() {
	return this[0];
};

function process(list) {
	var processor = lookupProcessor(list);
	var sublist;
}

function lookupProcessor(list) {
	var lookup = list[0];
	if (lookup instanceof List) {
		return processors.fncall;
	}
	var processor = processors[lookup];
	if (processor) return processor;
	return macros[lookup];
}

var processors = {};
var macros = {};

processors.pgm = function(list) {
	var result = "(function() {";
	result += processors.explist(list);
	return result + "})();"
};

processors.explist = function(list) {

};

processors.if = function(list) {
	return "(" + process(list[1]) +
		   " ? " + process(list[2]) +
		   " : " + process(list[3]) + ")\n";
};

processors.fncall = function(list) {
	if (list[0] instanceof List) {
		return "(" + process(list[0]) + ")(" + processors.parameters(list.rest) + ")";
	} else {
		return list[0] + "(" + processors.parameters(list.rest) + ")";
	}
};
