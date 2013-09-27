var macros = {};

function wrapMacro(macro) {
	return function(list, userdata) {
		return process(macro(list), userdata);
	}
}

/**
* (defmacro name (list) body) -> (fn (list) body)
* that gets evaled:
* eval("var __tempMacro = " + process(list));
* macros[name] = wrapMacro(__tempMacro); // after some sanity checks on the macro
* wrapMacro just runs the macro and does a "return process(macroResult);"
*/
macros.defmacro = function(list, userdata) {
	var name = list[1];
	list = list.slice(0).splice(2);
	list.unshift(Node('fn'));

	var str = process(list, userdata);
	eval("var __tempMacro = " + str);
	if (name in macros)
		console.error('Macro ' + name + ' is being re-defined');
	macros[name] = wrapMacro(__tempMacro);

	if (typeof ms_dumpMacros != 'undefined' && ms_dumpMacros === true) {
		return "macros['" + name + "'] = wrapMacro(" + str + ");\n";
	} else {
		return '';
	}
};

// TODO: need to update the parser to allow naked keywords to occur in backtick forms.
macros['`'] = function(list, userdata) {
	list = list[1];
	return deepToConstructionString(list);
}

function deepToConstructionString(items) {
	// TODO items may not necessarily be an array.
	var result = '[';
	for (var i = 0; i < items.length; ++i) {
		var item = items[i];
		if (i != 0) result += ',';

		if (item instanceof Array) {
			if (item[0].type == '~') {
				result += process(item[1]);
			} else if (item[0].type == '~@') {
				var arr = process(item[1]);
				for (var j = 0; j < arr.length; ++j) {
					if (j != 0) result += ',';
					result += arr[i];
				}
			} else {
				result += deepToConstructionString(item);
			}
		} else {
			result += item.toConstructionString();
		}
	}

	return result + ']';
}



// Not exactly macros at the moment
/**
* (defn name (params...) body) -> (def x (fn (params...) body))
*/
macros.defn = function(list, userdata) {
	return process(
		[Node('def'), list[1],
			[Node('fn'), list[2]].concat(rest(list, 3))], userdata);
};


/**
* (when exp body) -> (if exp (do body))
*/
macros.when = function(list, userdata) {
	return process([Node('if'), list[1], [Node('do')].concat(rest(list, 2))], userdata);
};

/**
* (do body) -> ((fn () body))
*/
macros.do = function(list, userdata) {
	return process([[Node('fn'), []].concat(rest(list, 1))], userdata);
};

// TODO: convert to a list of existing symbols instead of generating the JS
macros.type = function(list, userdata) {
	var result = "(function() { function " + list[1] + "(";

	var methodsStart;
	var directives = list[2][0];
	if (directives.type == 'jsobject') {
		methodsStart = 3;
		directives = list[2];
	} else {
		methodsStart = 2;
		directives = [];
	}

	var methodDefs = "";
	var constructor;
	for (var i = methodsStart; i < list.length; ++i) {
		if (list[i][0].key == 'ctor')
			constructor = list[i];
		else {
			methodDefs += list[1] + ".prototype." + list[i][0] 
						+ " = function(" + processors.fnparams(list[i][1], userdata) + ") {"
						+ processors.fnbody(rest(list[i], 2), userdata)
						+ "};\n"
		}
	}

	if (constructor) {
		result += processors.fnparams(constructor[1], userdata)
				+ ") {" + processors.fnbody(rest(constructor, 2).concat([Node('id', 'this')]), userdata)
				+ "}\n";
	} else {
		result += "){}\n";
	}

	var proto;
	var mixins;
	for (var i = 2; i < directives.length; i += 2) {
		if (directives[i-1].key == 'extend')
			proto = directives[i];
		else if (directives[i-1].key == 'mix')
			mixins = directives[i];
	}

	if (proto) {
		result += list[1] + ".prototype = Object.create(" + process(proto) + ");\n";
	}

	result += methodDefs;

	if (mixins) {
		result += "extend(" + list[1] + ".prototype, " + processors.parameters(rest(mixins, 1), userdata) + ");\n";
	}

	return result + "return " + list[1] + "; })()";
};

macros.deftype = function(list, userdata) {
	return process([Node('def'), list[1], [Node('fncall', 'type')].concat(rest(list, 1))], userdata);
};
