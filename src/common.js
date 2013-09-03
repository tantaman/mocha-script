function retSelf() { return this; }

function Symbol(symbol, postfix) {
	this.id = symbol;
	this.postfix = postfix;
}

Symbol.prototype.toString = function() {
	return this.id + this.postfix;
}