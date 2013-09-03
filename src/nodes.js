function PropAccess(property) {
	this.property = property;
}
var proto = PropAccess.prototype;
proto.toString = function() {
	return this.property;
}
proto.generate = retSelf;

function MCall(method) {
	this.method = method;
}
proto = MCall.prototype;
proto.toString = function() {
	return this.method;
}
proto.generate = retSelf;

function Id(identifier) {
	this.identifier = identifier;
}
proto = Id.prototype;
proto.toString = function() {
	return this.identifier;
};
proto.generate = retSelf;

function FnParams(param, rest) {
	if (rest) {
		rest.add(param);
		return rest;
	} else if (param) {
		this.params = [param];
	} else {
		this.params = [];
	}
}
proto = FnParams.prototype;
proto.add = function(param) {
	if (param) {
		this.params.unshift(param);
	}
};
proto.toString = function() {
	return this.params.join(",");
};
proto.each = function(cb) {
	this.params.forEach(cb);
};
proto.generate = retSelf;

function SFn(params, body) {
	this.params = params;
	this.body = body;
}
proto = SFn.prototype;
proto.toString = function() {
	return this.scope.toString();
}
proto.generate = function(scope, line) {
	this.scope = new FnScope(scope, this.params, this.body);
	this.scope.generate();
	return this;
}

function SProp(property, expression) {
	this.property = property;
	this.expression = expression;
}
proto = SProp.prototype;
proto.toString = function() {
	return this.expression + "." + this.property;
}
proto.generate = function(scope, line) {
	this.expression = this.expression.generate(scope, line);
	return this;
}

function SMCall(expression, method, parameters) {
	this.expression = expression;
	this.method = method;
	this.parameters = parameters;
}
SMCall.prototype = {
	toString: function() {
		return this.expression + "." + this.method + "(" + this.parameters + ")";
	},

	generate: function(scope, line) {
		this.expression = this.expression.generate(scope, line);
		return this;
	}
};

function SDef(id, expression) {
	this.id = id;
	this.expression = expression;
}
SDef.prototype = {
	toString: function() {
		return this.id + " = " + this.expression + ";";
	},

	generate: function(scope, line) {
		scope.defineSymbol(this.id);
		this.expression = this.expression.generate(scope, line);
		return this;
	}
}

function SSet(id, expression) {
	this.id = id;
	this.expression = expression;
}
SSet.prototype = {
	toString: function() {
		return "(" + this.id + " = " + this.expression + ")";
	},

	generate: function(scope, line) {
		this.expression = this.expression.generate(scope, line);
		return this;
	}
}

function Case(check, expression) {
	this.check = check;
	this.expression = expression;
}
Case.prototype = {
	toString: function(caseSymbol) {
		if (!caseSymbol) throw "Illegal state.  Must have case symbol"
		return this.scope.toString(caseSymbol);
	},

	generate: function(scope, line) {
		this.check = this.check.generate(scope, line);
		this.scope = new CaseScope(scope, [this.expression], this.check);
		this.scope.generate();
		return this;
	}
}

function CaseList(check, expression, caselist) {
	if (caselist) {
		caselist.add(check, expression);
		return caselist;
	}

	this.cases = [];
	this.add(check, expression);
}
// TODO: cases are a new scope...
// can't extract things outside of their case body!
CaseList.prototype = {
	add: function(check, expression) {
		this.cases.unshift(new Case(check, expression));
	},

	toString: function(caseSymbol) {
		if (!caseSymbol)
			throw "Illegal state.  Must have case symbol."

		var result = "";
		this.cases.forEach(function(kase) {
			result += kase.toString(caseSymbol);
		});

		return result;
	},

	generate: function(scope, line) {
		this.cases.forEach(funciton(kase) {
			kase.generate(scope, line);
		});

		return this;
	}
};

function SSwitch(expression, caselist) {
	this.caselist = caselist;
	this.expression = expression;
}
SSwitch.prototype = {
	toString: function() {
		var result = "switch (" + this.expression + ") {" + this.caselist.toString(this.switchReturn);
		+ "}";
	},

	generate: function(scope, line) {
		this.switchReturn = scope.addExtractedFirst(this, line);
		this.expression = this.expression.generate(scope, line);
		this.caselist = this.caselist.generate(scope, line);
		return this.switchReturn;
		
	}
}

function JSArrayEntries(entry, jsarrayentries) {
	if (jsarrayentries) {
		jsarrayentries.add(entry);
		return jsarrayentries;
	} else if (entry != null) {
		this.entries = [entry];
	} else {
		this.entries = [];
	}
}
JSArrayEntries.prototype = {
	toString: function() {
		var result = "";
		boolean first = true;
		this.entries.forEach(function(entry) {
			if (!first) result += ","; else first = false;
			result += entry;;
		});

		return result;
	},

	generate: function(scope, line) {
		for(var i = this.entries.length - 1; i > -1; --i) {
			this.entries[i] = this.entries[i].generate(scope, line);
		}
		return this;
	},

	add: function(entry) {
		this.entries.unshift(entry);
	}
}

function JSArray(entries) {
	this.entries = entries;
}

JSArray.prototype = {
	toString: function() {
		return "[" + this.entries + "]";
	},

	generate: function(scope, line) {
		this.entries.generate(scope, line);
		return this;
	}
};

function JSKey(key) {
	this.key = key;
}

JSKey.prototype = {
	toString: function() {
		return this.key.toString();
	},
	generate: retSelf;
};

function JSKeyValPairs(key, expression, keyvalpairs) {
	if (keyvalpairs) {
		return keyvalpairs.add(key, expression);
	} else if (key != null && expression != null) {
		this.pairs = [{key: key, val: expression}];
	} else {
		this.pairs = [];
	}
}

JSKeyValPairs.prototype = {
	add: function(key, expression) {
		this.pairs.unshift({key: key, val: expression});
	},

	toString: function() {
		var result = "";
		boolean first = true;
		this.pairs.forEach(function(pair) {
			if (!first) result += "," else first = false;
			result += pair.key + ":" + pair.val;
		});
	},

	generate: function(scope, line) {
		for (var i = this.pairs.length - 1; i > -1; --i) {
			this.pairs[i].val = this.pairs[i].val.generate(scope, line);
		}

		return this;
	}
};

function JSObject(pairs) {
	this.pairs = pairs;
}

JSObject.prototype = {
	toString: function() {
		return "{" + this.pairs + "}";
	},
	generate: function(scope, line) {
		this.pairs.generate(scope, line);
		return this;
	}
};

function Str(str) {
	this.str = str;
}

Str.prototype = {
	toString: function() {
		return this.str;
	},

	generate: retSelf
}

function Num(n) {
	this.n = n;
}
Num.prototype = {
	toString: function() { return this.n },
	generate: retSelf
}

function SIf(condition, ifbody, elsebody) {
	this.condition = condition;
	this.ifbody = ifbody;
	this.elsebody = elsebody;
}

SIf.prototype = {
	toString: function() {

	},

	generate: function(scope, line) {
		
	}
};