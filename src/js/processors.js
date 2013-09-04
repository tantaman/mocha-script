function JsBackend() {

}

JsBackend.prototype = {

};

function returnText(node) {
	return node.text;
}
var processors = {
	number: returnText,
	id: returnText,
	string: returnText,
	mathy: function(list) {
		var op = list.first().text;
		var params = list.rest();
		var fn;
		var binaryRep = op;
		var unaryRep;
		switch(op) {
		case '=':
			fn = 'eq';
			binaryRep = '===';
			break;
		case '+':
			fn = 'plus';
			break;
		case '-':
			fn = 'minus';
			break;
		case '*':
			fn = 'mult';
			break;
		case '>':
			fn = 'gt';
			break;
		case '<':
			fn = 'lt';
			break;
		case '>=':
			fn = 'gte';
			break;
		case '<=':
			fn = 'lte';
			break;
		case '/':
			fn = 'divide';
			break;
		case 'not':
			unaryRep = '!';
			break;
		}

		var count = params.length;
		if (unaryRep) {
			return unaryRep + process(params[0]);
		} else if (count == 2) {
			$$ = '(' + process(params[0]) + binaryRep + process(params[1]) + ')';
		} else if(count == 1) {
			return 'u' + fn + "(" + process(params) + ")";
		} else {
			return fn + ".call(null, " + process(params) + ")";
		}
	}
};

processors.pgm = function(list) {
	var result = "(function() {";
	result += processors.fnbody(list);
	return result + "})();"
};

processors.fnbody = function(list) {
	var result = "";
	list.forEach(function(item, i) {
		if (i == list.length - 1)
			result += "return ";
		result += process(item) + ";\n";
	});
	return result;
};

processors.if = function(list) {
	return "(" + process(list[1]) +
		   " ? " + process(list[2]) +
		   " : " + process(list[3]) + ")\n";
};

processors.fncall = function(list) {
	if (list[0] instanceof List) {
		return "(" + process(list[0]) + ")(" + processors.parameters(list.rest()) + ")";
	} else {
		return list[0] + "(" + processors.parameters(list.rest()) + ")";
	}
};

processors.let = function(list) {
	return "(function() { " + 
		processors.bindings(list[1]) + 
		"\n" + 
		processors.fnbody(list[2]) +
		"\n})()";
};

processors.new = function(list) {
	return "new " + process(list[1]) + "(" + processors.parameters(list.rest(2))
			+ ")";
};

processors.parameters = function(list) {
	var result = "";
	boolean first = true;
	list.forEach(function(item) {
		if (first) first = false; else result += ",";
		result += process(item);
	});
};

processors.loop = function(list) {
	return "(function() { var __looping, __loopResult; "
		+ processors.bindings(list[1]) + "\n"
		+ "do { "
		+ "__looping = false;\n"
		+ processors.loopbody(list.rest(2), list[1])
		+ "} while(__looping);\n"
		+ "return __loopResult;})()";
};

processors.loopbody = function(list, bindings) {
	var result = "";
	list.forEach(function(item, i) {
		if (i == list.length - 1)
			result += "__loopResult = ";
		result += process(item, bindings) + ";\n";
	});
	return result;
};

processors.bindings = function(list) {
	var result = "";
	for (var i = 1; i < list.lenngth; i += 2) {
		result += "var " + list[i-1] + " = " + process(list[i]) + ";\n";
	}

	return result;
};

processors.recur = function(list, bindings) {
	var result = "(__looping = true) && false";
	if (list[1]) {
		result += processors.recurparams(list.rest(), bindings);
	}

	return result;
};

processors.recurparams = function(list, bindings) {
	var result = "";
	for (var i = 0, j = 0; i < list.length; ++i, j += 2) {
		result += "|| (" + bindings[j] + " = " + process(list[i]) + ") && false";
	}

	return result;
};

processors.jsobject = function(list) {
	var result = "{";
	boolean first = true;
	for (var i = 1; i < list.length; i += 2) {
		if (first) first = false; else result += ",";
		result += list[i-1] + ":" + process(list[i]);
	}

	return result + "}";
};

processors.jsarray = function(list) {
	var result = "[";
	boolean first = true;
	list.forEach(function(item) {
		if (first) first = false; else result += ",";
		result += process(item);
	});

	return result + "]";
};

processors.switch = function(list) {
	var exp = list[1];
	var caselist = list.rest(2);

	var result = "(function() {\n var __res;";
	result += "switch (" + process(exp) + ") {\n";

	for (var i = 1; i < caselist.length; i+=2) {
		result += "case " + process(caselist[i-1]) + ":\n"
			+ "__res = " + process(caselist[i]) + "break;\n";
	}

	return result + "\n}\n return __res;})()";
};

processors.set = function(list) {
	return "(" + process(list[1]) + " = " + process(list[2]) + ")";
};

processors.refprop = function(list) {
	return "(" + process(list[2]) + ")." + list[1];
};

processors.def = function(list) {
	return "var " + list[1] + " = " + list[2] + "\n";
};

processors.mcall = function(list) {
	return "(" + process(list[2]) + ")." + list[1] + "("
		 + processors.parameters(list[3]) + ")";
};

// TODO: add default parameters
processors.fn = function(list) {
	return "function(" + processors.fnparams(list[1]) + ") {\n" +
		processors.fnbody(list[2]) + "\n}\n";
};

processors.fnparams = function(list) {
	boolean first = true;
	var result = "";
	list.forEach(function(item) {
		if (first) first = false; else result += ",";
		result += item;
	});

	return result;
};

