/*
jison grammar.jison tokens.jisonlex 
*/

%%

pgm
	: sexplist ENDOFFILE
	;

sexplist
	: sexp sexplist 
	|
	;

sexp
	: slet
	| sif
	| scase
	| sset
	| sprop
	| sfn
	| LPAREN ID params RPAREN
	| LPAREN MATHY params RPAREN
	;

params
	: sexp params
	| ID params
	| STRING params
	| NUMBER params
	|
	;

slet
	: LPAREN LET LPAREN letparams RPAREN sexplist RPAREN
	;

letparams
	: ID exp letparams
	|
	;

sif
	: LPAREN IF sexp exp RPAREN
	| LPAREN IF sexp exp exp RPAREN
	;

exp
	: ID
	| NUMBER
	| STRING
	| sexp
	;

scase
	: LPAREN CASE caselist RPAREN
	;

caselist
	: sexp exp caselist
	|
	;

sset
	: LPAREN SET ID exp RPAREN
	| LPAREN SET sprop exp RPAREN
	;

sprop
	: LPAREN PROPACCESS exp RPAREN
	;

sfn
	: LPAREN FN LPAREN fnparams RPAREN sexplist RPAREN
	;

fnparams
	: ID fnparams
	|
	;
