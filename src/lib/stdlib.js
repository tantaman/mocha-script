(function() {

var lo;
if (typeof module == 'object' && module.exports) {
	lo = require('./stdlib-dashlo');
} else {
	var lo = _;
}

var lib = {
	boolNary: function boolNary(binary, args) {
		var len = args.length;
		var result = true;
		for (var i = 1; i < len; ++i) {
			result = binary(args[i-1], args[i]);
			if (!result)
				break;
		}

		return result;
	},

	nary: function nary(binary, args) {
		var len = args.length;
		var result = args[0];
		for (var i = 1; i < len; ++i)
			result = binary(result, args[i]);
		return result;
	},

	blt: function blt(l, r) { return l < r; },
	bgt: function bgt(l, r) { return l > r; },
	beq: function beq(l, r) { return l = r; },
	blte: function blte(l, r) { return l <= r; },
	bgte: function bgte(l, r) { return l >= r; },
	bplus: function bplus(l, r) { return l + r; },
	bminus: function bminus(l, r) { return l - r; },
	bmult: function bmult(l, r) { return l * r; },
	bdivide: function bdivide(l, r) { return l / r; },

	lt: function lt() { return boolNary(blt, arguments); },
	gt: function gt() { return boolNary(bgt, arguments); },
	eq: function eq() { return boolNary(beq, arguments); },
	lte: function lte() { return boolNary(blte, arguments); },
	gte: function gte() { return boolNary(bgte, arguments); },
	plus: function plus() { return nary(bplus, arguments); },
	minus: function minus() { return nary(bminus, arguments); },
	mult: function mult() { return nary(bmult, arguments); },
	divide: function divide() { return nary(bdivide, arguments); },

	not: function not(a) {return !a;},

	uminus: function uminus(l) { return -l; },
	udivide: function udivide(l) { return 1 / l; },

	log: function log() { console.log.apply(console, arguments); },

	foreach: function foreach(arr, fn) { arr.forEach(fn); },
	get: function get(vec, key) {return vec[key];},

	isinstance: function isinstance(a, b) {return a instanceof b;}
};

lib.ult = lib.ugt = lib.ulte = lib.ugte = function() {return true;};
lib.uplus = lib.umult = lib.identity = function(l) { return l; };


var glob;
if (typeof global == 'object') {
	glob = global;
} else {
	glob = window;
}

function addToGlobal(obj) {
	for (var key in obj) {
		glob[key] = obj[key];
	}	
}

addToGlobal(lib);
addToGlobal(lo);

})();
