/*
jison grammar.jison tokens.jisonlex 
*/

%%

pgm
	: explisti ENDOFFILE
		{return processors.pgm($1)}
	;

explisti
	: exp explisti
		{$$ = [$1].concat($2);}
	|
		{$$ = [];}
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
	| sloop
		{$$ = $1;}
	| srecur
		{$$ = $1;}
	| LPAREN sexp params RPAREN
		{$$ = [$2].concat($3);}
	| LPAREN NEW id params RPAREN
		{$$ = [Node('new'), $3].concat($4);}
	| LPAREN id params RPAREN
		{$$ = [Node('fncall', $2.key)].concat($3);}
	| LPAREN mathy params RPAREN
		{$$ = [$2].concat($3);}
	;

mathy
	: MATHY
		{$$ = Node('mathy', $1)}
	;

params
	: exp params
		{$$ = [$1].concat($2);}
	|
		{$$ = [];}
	;

sloop
	: LPAREN LOOP LPAREN letparams RPAREN explisti RPAREN
		{$$ = [Node('loop'), $4];
		$$.concat($6);}
	;

srecur
	: LPAREN RECUR recurparams RPAREN
		{$$ = [Node('recur')].concat($3);}
	;

recurparams
	: exp recurparams
		{$$ = [$1].concat($2)}
	|
		{$$ = []}
	;

slet
	: LPAREN LET LPAREN letparams RPAREN explisti RPAREN
		{$$ = [Node('let'), $4].concat($6);}
	;

letparams
	: id exp letparams
		{$$ = [$1, $2].concat($3);}
	|
		{$$ = [];}
	;

sif
	: LPAREN IF exp exp RPAREN
		{$$ = [Node('if'), $3, $4];}
	| LPAREN IF exp exp exp RPAREN
		{$$ = [Node('if'), $3, $4, $5];}
	;

exp
	: id
		{$$ = $1;}
	| NUMBER
		{$$ = Node('number', yytext);}
	| STRING
		{$$ = Node('string', yytext);}
	| jsdata
		{$$ = $1;}
	| sexp
		{$$ = $1;}
	;

jsdata
	: jsobject
		{$$ = $1}
	| jsarray
		{$$ = $1}
	;

jsobject
	: LCURLY jskeyvalpairs RCURLY
		{$$ = [Node('jsobject', '')].concat($2);}
	;

jskeyvalpairs
	: jskey COLON exp jskeyvalpairs
		{$$ = [$1, $3].concat($4);}
	|
		{$$ = [];}
	;

jskey
	: id
		{$$ = $1;}
	| STRING
		{$$ = Node('string', yytext);}
	;

jsarray
	: LBRACKET jsarrayentries RBRACKET
		{$$ = [Node('jsarray', '')].concat($2);}
	;

jsarrayentries
	: exp jsarrayentries
		{$$ = [$1].concat($2)}
	|
		{$$ = [];}
	;

sswitch
	: LPAREN SWITCH exp caselist RPAREN
		{$$ = [Node('switch'), exp].concat(caselist);}
	;

caselist
	: exp exp caselist
		{$$ = [exp, exp].concat(caselist);}
	|
		{$$ = [];}
	;

sset
	: LPAREN SET id exp RPAREN
		{$$ = [Node('set'), $3, $4];}
	| LPAREN SET sprop exp RPAREN
		{$$ = [Node('set'), $3, $4];}
	;

sdef
	: LPAREN DEF id exp RPAREN
		{$$ = [Node('def'), $3, $4];}
	;

smcall
	: LPAREN mcall exp params RPAREN
		{$$ = [Node('mcall', ''), $2, $3].concat($4);}
	;

sprop
	: LPAREN propaccess exp RPAREN
		{$$ = [Node('refprop', ''), $2, $3];}
	;

sfn
	: LPAREN FN LPAREN fnparams RPAREN explisti RPAREN
		{$$ = [Node('fn'), $4].concat($6);}
	;

fnparams
	: id fnparams
		{$$ = [$1].concat($2);}
	|
		{$$ = [];}
	;

id
	: ID
		{$$ = Node('id', yytext);}
	;

mcall
	: MCALL
		{$$ = Node('id', yytext.substring(1));}
	;

propaccess
	: PROPACCESS
		{$$ = Node('id', yytext.substring(1));}
	;
