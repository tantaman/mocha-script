/*
jison grammar.jison tokens.jisonlex 
*/

%{
	if (typeof module != 'undefined') {
		var nodes = require('./nodes');
	}
%}

%%

pgm
	: explist ENDOFFILE
		{return new GlobalScope($1).generate().toString();}
	;

explist
	: explisti
		{$$ = $1;}
	;

explisti
	: exp explisti
		{$$ = new ExpList($1, $2);}
	|
		{$$ = new ExpList();}
	;

sexp
	: slet
		{$$ = $1;}
	| sif
		{$$ = $1;}
	| sswitch
		{$$ = $1;}
	| sset
		{$$ = $1;}
	| sprop
		{$$ = $1;}
	| smcall
		{$$ = $1;}
	| sdef
		{$$ = $1;}
	| sfn
		{$$ = $1;}
	| LPAREN sfn params RPAREN
		{$$ = new LambdaCallSExp($2, $3)}
	| LPAREN NEW id params RPAREN
		{$$ = new NewSExp($3, $4);}
	| LPAREN id params RPAREN
		{$$ = new CallSExp($2, $3);}
	| LPAREN mathy params RPAREN
		{$$ = new MathSExp($2, $3);}
	;

mathy
	: MATHY
		{$$ = new Mathy($1);}
	;

params
	: exp params
		{$$ = new Params($1, $2);}
	|
		{$$ = new Params();}
	;

/*TODO: we are going to have to actually build up a graph of nodes
so we can do lets efficiently and correclty handle variable hoisting
and other problems of JS scoping.
This naive approach, while it'll get things working, isn't going to work
in the long run.*/
slet
	: LPAREN LET LPAREN letparams RPAREN explist RPAREN
		{$$ = new SLet($4, $6);}
	;

letparams
	: id exp letparams
		{$$ = new LetParams($1, $2, $3);}
	|
		{$$ = new LetParams();}
	;

sif
	: LPAREN IF exp exp RPAREN
		{$$ = new SIf($3, $4);}
	| LPAREN IF exp exp exp RPAREN
		{$$ = new SIf($3, $4, $5);}
	;

exp
	: id
		{$$ = $1;}
	| NUMBER
		{$$ = new Num(yytext);}
	| STRING
		{$$ = new Str(yytext);}
	| jsdata
		{$$ = $1;}
	| sexp
		{$$ = $1;}
	;

jsdata
	: jsobject
		{$$ = $1;}
	| jsarray
		{$$ = $1;}
	;

jsobject
	: LCURLY jskeyvalpairs RCURLY
		{$$ = new JSObject($2);}
	;

jskeyvalpairs
	: jskey COLON exp jskeyvalpairs
		{$$ = new JSKeyValPairs($1, $3, $4);}
	|
		{$$ = new JSKeyValPairs();}
	;

jskey
	: id
		{$$ = new JSKey($1);}
	| STRING
		{$$ = new JSKey(new Str(yytext));}
	;

jsarray
	: LBRACKET jsarrayentries RBRACKET
		{$$ = new JSArray($2);}
	;

jsarrayentries
	: exp jsarrayentries
		{$$ = new JSArrayEntries($1, $2);}
	|
		{$$ = new JSArrayEntries();}
	;

sswitch
	: LPAREN SWITCH exp caselist RPAREN
		{$$ = new SSwitch($3, $4);}
	;

caselist
	: exp exp caselist
		{$$ = new CaseList($1, $2, $3);}
	|
		{$$ = new CaseList();}
	;

sset
	: LPAREN SET id exp RPAREN
		{$$ = new SSet($3, $4);}
	| LPAREN SET sprop exp RPAREN
		{$$ = new SSet($3, $4);}
	;

sdef
	: LPAREN DEF id exp RPAREN
		{$$ = new SDef($3, $4);}
	;

smcall
	: LPAREN mcall exp params RPAREN
		{$$ = new SMCall($3, $2, $4);}
	;

sprop
	: LPAREN propaccess exp RPAREN
		{$$ = new SProp($3, $2);}
	;

sfn
	: LPAREN FN LPAREN fnparams RPAREN explist RPAREN
		{$$ = new SFn($4, $6);}
	;

fnparams
	: id fnparams
		{$$ = new FnParams($1, $2);}
	|
		{$$ = new FnParams();}
	;

id
	: ID
		{$$ = new Id(yytext);}
	;

mcall
	: MCALL
		{$$ = new MCall(yytext);}
	;

propaccess
	: PROPACCESS
		{$$ = new PropAccess(yytext.substring(1));}
	;
