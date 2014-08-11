// first just re-write the async funcs
// then the await statements?

// async funcs could be defined at any level of nesting...
// so we have to inspect all the way down?
// someone could do pathological shit like make a namespace
// in an argument field.

// We should just make a parser smart
// and build a table of pointer to the async funcs
// so we don't have to find them :)
// we can do the same for the awaits?

function perform(ast, table) {
	table.async.forEach(function(asyncDef) {
		rewrite(asyncDef);
	});
}

function rewrite(asyncDef) {
	console.log(asyncDef);
}

/*
async function a(arg1,arg2,...) {

}
->
function a(arg1,arg,...) {
	var my_wait_handle = new WaitHandle();

	function all_the_code(caller_wait_handle) {
		all the codez...

		and if there is an await in this biz?
		funciton rest_the_code(result) {
		
			my_wait_handle.resolve(final_result);
		}

		my_wait_handle.register(rest_the_code); // replaces old registration
		async_func(args)(my_wait_handle);
	}

	my_wait_handle.register(all_the_code);
	my_wait_handle.onResolve(caller_wait_handle);

	// my wait handle would need to be called before
	// all the codez is run.
	return my_wait_handle;
}
*/


/*
Take the provided AST
re-write the await/async bits

Cases to handle:
-Awaits in branching code (ors, ifs, ands, etc.)
-The chaining of async function calls


async function (params) {
	code before await...

	var result = await read_file('filename');

	return result;
}


This stuff may be all wrongish since we await on the
returned handles...
becomes:

function (caller_wait_handle (or cb), params) {
	var my_wait_handle = new WaitHandle();

	code that existed before an await in this method...

	function code_after_await(result) {
		stuff stuff
		result = other stuff...
		
		my_wait_handle.resolve(result);
	}

	my_wait_handle.register(code_after_await); // <-- return value of this is
	// passed to the onResolve listener

	awaitable_function(my_wait_handle, other_args);

	my_wait_handle.onResolve(caller_wait_handle); // called after our func fully completes
}


ex 2:

async function (params) {
	var a1_result = await a1();
	var a2_result = await a2();

	return a1_result + a2_result;
}

function (caller_wait_handle (or cb), params) {
	var my_wh = new WaitHandle();

	async function code_after_wait(__arg1) {
		var a1_result = __arg1;
		var a2_result = await a2();

		result = a1_result + a2_result;
		my_wh.resolve(result);
	}

	my_wh.register(code_after_await);
	a1(my_wh);

	my_wh.onResolve(caller_wait_handle);

	return my_wh;
}
 |
\ /
// sequential waits are a special case
// since we just want to re-use our same wait handle.
function (caller_wait_handle (or cb), params) {
	var my_wh = new WaitHandle();

	function code_after_wait(__arg1) {
		var a1_result = __arg1;

		function code_after_wait(__arg1) {
			var a2_result = __arg1;
			result = a1_result + a2_result;
			my_wh.resolve(result);
		}

		my_wh.regiser(code_after_wait); // this will overwrite the old
		// registration since it has already been used

		// onResolve has already been set in the sequential await case...

		// We know we are in a sequential await case
		// when we define a code_after_wait function
		// that ends up being async.

		a2(my_wh);
	}

	my_wh.regiser(code_after_wait);
	my_wh.onResolve(caller_wait_handle);

	a1(my_wh);

	return my_wh;
}

So we have a weird case of serial awaits...
with them possibly getting resolved twice?
Well just don't allow a registered callback on a wait handle
to be called more than once and don't allow multiple resolutions at runtime...

We'll get lots of resolve calls but its ok since they are all resolving with the same 
result?

Compiler can be smart enough to remove multiple resolves?
Which resolves do we kill?  The new ones I surmise...

So we need to introduce some clever tricks for handling sequential awaits?







async function() {
	return await f2();
}

async function f2() {
	return 2;
}


*/



