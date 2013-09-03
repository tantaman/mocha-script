function JsBackend() {

}

JsBackend.prototype = {

};

function process(list) {
	var processor = lookupProcessor(list);
	var sublist;
}

function lookupProcessor(list) {

}

var procesors = {};

procesors.if = function(list) {
	return "(" + process(list[0]) +
		   " ? " + process(list[1]) +
		   " : " + process(list[2]) + ")\n";
}