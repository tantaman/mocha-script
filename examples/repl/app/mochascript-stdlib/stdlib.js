function boolNary(binary, args) {
	var len = args.length;
	var result = true;
	for (var i = 1; i < len; ++i) {
		result = binary(args[i-1], args[i]);
		if (!result)
			break;
	}

	return result;
}

function nary(binary, args) {
	var len = args.length;
	var result = args[0];
	for (var i = 1; i < len; ++i)
		result = binary(result, args[i]);
	return result;
}

function blt(l, r) { return l < r; }
function bgt(l, r) { return l > r; }
function beq(l, r) { return l = r; }
function blte(l, r) { return l <= r; }
function bgte(l, r) { return l >= r; }
function bplus(l, r) { return l + r; }
function bminus(l, r) { return l - r; }
function bmult(l, r) { return l * r; }
function bdivide(l, r) { return l / r; }

function lt() { return boolNary(blt, arguments); }
function gt() { return boolNary(bgt, arguments); }
function eq() { return boolNary(beq, arguments); }
function lte() { return boolNary(blte, arguments); }
function gte() { return boolNary(bgte, arguments); }
function plus() { return nary(bplus, arguments); }
function minus() { return nary(bminus, arguments); }
function mult() { return nary(bmult, arguments); }
function divide() { return nary(bdivide, arguments); }

function not(a) {return !a;}
var ult, ugt, ulte, ugte;
ult = ugt = ulte = ugte = function() {return true;};

var uplus, umult, identity;
uplus = umult = identity = function(l) { return l; };
function uminus(l) { return -l; }
function udivide(l) { return 1 / l; }

for (var key in _) {
	this[key] = _[key];
}

function log() {
	console.log.apply(console, arguments);
}

function foreach(arr, fn) { arr.forEach(fn); }
function get(vec, key) {return vec[key];}

function isinstance(a, b) {return a instanceof b;}