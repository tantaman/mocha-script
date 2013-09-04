function Node(type, key, text) {
	this.key = key;
	this.text = text || key;
	this.type = type;
}

Node.prototype.toString = function() {
	return this.text;
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

function process(list, userdata) {
	var processor = lookupProcessor(list);
	if (!processor)
		throw "Illegal state.  No processor for " + list;
	return processor(list, userdata);
}

function lookupProcessor(list) {
	var lookup = list[0];
	if (lookup instanceof List) {
		return processors.fncall;
	}

	var processor = macros[lookup.key];
	if (processor) return processor;

	processor = processors[lookup.type];
	return processor;
}