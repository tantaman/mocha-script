
if (typeof module !== 'undefined' && require.main === module) {
	var oldprocess = process; 
}

if (typeof module == 'object' && module.exports) {
	require('./stdlib');
}

(function(root) {

