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
	var result;
	for (var i = 1; i < len; ++i)
		result = binary(args[i-1], args[i]);
	return result;
}

function blt(l, r) { return l < r; }
function bgt(l, r) { return l > r; }
function beq(l, r) { return l = r; }
function blte(l, r) { return l <= r; }
function bgte(l, r) { return l >= r; }
function bplus(l, r) { return l + r; }
function bminus(l, r) { return l - r; }
function btimes(l, r) { return l * r; }
function bminus(l, r) { return l * r; }
function bdivide(l, r) { return l / r; }

function lt() { boolNary(blt, arguments); }
function gt() { boolNary(bgt, arguments); }
function eq() { boolNary(beq, arguments); }
function lte() { boolNary(blte, arguments); }
function gte() { boolNary(bgte, arguments); }
function plus() { nary(bplus, arguments); }
function minus() { nary(bminus, arguments); }
function times() { nary(btimes, arguments); }
function divide() { nary(bdivide, arguments); }

function not(a) {return !a;}
var ult, ugt, ulte, ugte;
ult = ugt = ulte = ugte = function() {return true;};

var uplus, utimes, identity;
uplus = utimes = identity = function(l) { return l; };
function uminus(l) { return -l; }
function udivide(l) { return 1 / l; }

for (var key in _) {
	this[key] = _[key];
}

function log() {
	console.log.apply(console, arguments);
}