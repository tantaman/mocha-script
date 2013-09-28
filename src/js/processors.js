function process(list, userdata) {
	if (!list) return null;
	var processor = lookupProcessor(list);
	if (!processor)
		throw "Illegal state.  No processor for " + list;
	return processor(list, userdata);
}
if (oldprocess) {
	process.argv = oldprocess.argv;
	process.exit = oldprocess.exit;
}

// TODO: are there any conflicts with this method of lookup?
// mainly worried about the id to fncall conversion stuff...

// TODO: we need to make the lookup smarter
// It shouldn't be just by name anymore but
// by name, num args, & arg types.
// this will allow us to construct much simpler macros
// as well as overload macro definitions.
function lookupProcessor(list) {
	if (list instanceof Node)
		return returnText;

	var lookup = list[0];
	if (lookup instanceof Array) {
		return processors.fncall;
	}

	// TODO: evaluate the sanity of this.
	if (list[0].type == "string" || list[0].type == "number")
		return processors.refprop;

	var processor = macros[lookup.key];
	if (processor) return processor;

	processor = processors[lookup.key];
	if (processor) return processor;

	processor = processors[lookup.type];
	if (processor) return processor;

	return processors.fncall;
}

function returnText(node) {
	return node.toString();
}
var processors = {
	number: returnText,
	id: returnText,
	string: returnText,
	mathy: function(list, userdata) {
		var op = first(list).text;
		var params = rest(list);
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
			return unaryRep + process(params[0], userdata);
		} else if (count == 2) {
			return '(' + process(params[0], userdata) + binaryRep + 
					process(params[1], userdata) + ')';
		} else if(count == 1) {
			return 'u' + fn + "(" + processors.parameters(params, userdata) + ")";
		} else {
			return fn + ".call(null, " + processors.parameters(params, userdata) + ")";
		}
	}
};

processors.pgm = function(list, userdata) {
	var result = "";
	userdata = userdata || {};
	var unwrap = (typeof ms_unwrap != 'undefined' && ms_unwrap === true) ? true : false;
	if (!unwrap)
		result = "(function() {";
	userdata.unwrap = unwrap;

	result += processors.fnbody(list, userdata);
	return result + ((unwrap) ? "" : "})();");
};

processors.unroll = function(list, userdata) {
	return processors.fnbody([list], userdata);
}

function isUnroll(item) {
	return item instanceof Array && item.length == 2 && item[0].type == 'unroll';
}

function restUnrolled(unrolled) {
	if (unrolled[0].type === 'jsarry')
		return rest(unrolled);
	return unrolled;
}

// Allow userdata.commas and userdata.unwrap
// so we can leverage this for unrolling?
// rename from fnbody to... exp list?
processors.fnbody = function(list, userdata, unroll) {
	var result = unroll || [];
	list.forEach(function(item, i) {
		if (i == list.length - 1) {
			if (item instanceof Array && (item[0].key == 'def' || item[0].key == 'defn')) {
				result.push(process(item, userdata) + ";\n");
				result.push(item[1] + ";\n");
			} else {
				handleItem(item);
			}
		} else {
			handleItem(item);
		}
	});

	function handleItem(item) {
		if (isUnroll(item)) {
			item[1].forEach(function(unrolled, i) {
				processors.fnbody(restUnrolled(unrolled), userdata, result);
			});
		} else {
			result.push(process(item, userdata) + ";\n");
		}
	}

	if (!userdata.unwrap && !unroll) {
		result[result.length - 1] = "return " + result[result.length - 1];
	}

	return result.join("");
};

processors.if = function(list, userdata) {
	return "(" + process(list[1], userdata) +
		   " ? " + process(list[2], userdata) +
		   " : " + process(list[3], userdata) + ")\n";
};

processors.instanceof = function(list, userdata) {
	return "(" + process(list[1], userdata) + 
		" instanceof " + process(list[2], userdata) +
		")";
};

processors.typeof = function(list, userdata) {
	return "(typeof " + process(list[1], userdata) + ")";
};

processors.fncall = function(list, userdata) {
	if (list[0] instanceof Array) {
		return "(" + process(list[0], userdata) + ")("
				+ processors.parameters(rest(list), userdata) + ")";
	} else {
		return list[0] + "(" + processors.parameters(rest(list), userdata) + ")";
	}
};

processors.let = function(list, userdata) {
	return "(function() { " + 
		processors.bindings(list[1], userdata) + 
		"\n" + 
		processors.fnbody(rest(list, 2), userdata) +
		"\n})()";
};

processors.new = function(list, userdata) {
	return "new " + process(list[1], userdata)
		 	+ "(" + processors.parameters(rest(list, 2), userdata)
			+ ")";
};

processors.parameters = function(list, userdata, unrolling) {
	var result = "";
	var first = !unrolling;
	list.forEach(function(item) {
		if (first) first = false; else result += ",";
		if (item.type == 'refprop')
			result += '"' + item.toString() + '"';
		else {
			if (item instanceof Array && item.length == 2 && item[0].type === 'unroll') {
				item[1].forEach(function(unrolled) {
					result += processors.parameters(unrolled, userdata, true);
				});
			} else {
				result += process(item, userdata);
			}
		}
	});

	return result;
};

processors.loop = function(list, userdata) {
	return "(function() { var __looping, __loopResult; "
		+ processors.bindings(list[1], userdata) + "\n"
		+ "do { "
		+ "__looping = false;\n"
		+ processors.loopbody(rest(list, 2), list[1])
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

processors.bindings = function(list, userdata) {
	var result = "";
	for (var i = 1; i < list.length; i += 2) {
		result += "var " + list[i-1] + " = " + process(list[i], userdata) + ";\n";
	}

	return result;
};

processors.recur = function(list, bindings) {
	var result = "(__looping = true) && false";
	if (list[1]) {
		result += processors.recurparams(rest(list), bindings);
	}

	return result;
};

processors.recurparams = function(list, bindings) {
	var result = "";
	for (var i = 0, j = 0; i < list.length; ++i, j += 2) {
		result += "|| (" + bindings[j] + " = " + process(list[i], bindings) + ") && false";
	}

	return result;
};

processors.jsobject = function(list, userdata) {
	var result = "{";
	var first = true;
	for (var i = 2; i < list.length; i += 2) {
		if (first) first = false; else result += ",";
		result += list[i-1] + ":" + process(list[i], userdata);
	}

	return result + "}";
};

processors.jsarray = function(list, userdata) {
	var result = "[";
	var first = true;
	for (var i = 1; i < list.length; ++i) {
		var item = list[i];
		if (first) first = false; else result += ",";
		result += process(item, userdata);
	}

	return result + "]";
};

processors.switch = function(list, userdata) {
	var exp = list[1];
	var caselist = rest(list, 2);

	var result = "(function() {\n var __res;";
	result += "switch (" + process(exp, userdata) + ") {\n";

	for (var i = 1; i < caselist.length; i+=2) {
		result += "case " + process(caselist[i-1], userdata) + ":\n"
			+ "__res = " + process(caselist[i], userdata) + "break;\n";
	}

	return result + "\n}\n return __res;})()";
};

processors['!'] = function(list, userdata) {
	if (list.length == 4) {
		// TODO: return the object upon which the value was set?
		return "(" + processors.refprop([list[2], list[1]], userdata) + " = " + process(list[3], userdata) + ")";
	} else {
		return "(" + process(list[1], userdata) + " = " + process(list[2], userdata) + ")";
	}
};

processors.refprop = function(list, userdata) {
	if (list[0].type == "refprop") {
		return "(" + process(list[1], userdata) + ")." + list[0];
	} else {
		return "(" + process(list[1], userdata) + ")[" + process(list[0]) + "]";
	}
};

processors.def = function(list, userdata) {
	return "var " + list[1] + " = " + process(list[2], userdata);
};

processors.mcall = function(list, userdata) {
	return "(" + process(list[1], userdata) + ")" + list[0] + "("
	 + processors.parameters(rest(list, 2), userdata) + ")";
};

// TODO: add default parameters
processors.fn = function(list, userdata) {
	return "function(" + processors.fnparams(list[1], userdata) + ") {\n" +
		processors.fnbody(rest(list, 2), userdata) + "}";
};

processors.fnparams = function(list, userdata) {
	var first = true;
	var result = "";
	list.forEach(function(item) {
		if (first) first = false; else result += ",";
		result += item;
	});

	return result;
};

