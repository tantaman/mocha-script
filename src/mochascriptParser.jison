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
	: LPAREN explisti RPAREN
		{if ($2.length && $2[0].type == 'id')
			$2[0].type = 'fncall';
		$$ = $2;}
	;

mathy
	: MATHY
		{$$ = Node('mathy', $1)}
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
	| tilde
		{$$ = $1;}
	| tildeat
		{$$ = $1;}
	| backtick
		{$$ = $1;}
	| sexp
		{$$ = $1;}
	| mathy
		{$$ = $1;}
	| mcall
		{$$ = $1;}
	| propaccess
		{$$ = $1;}
	;

tilde
	: TILDE exp
		{$$ = [Node('~', ''), $2];}
	;

tildeat
	: TILDE_AT exp
		{$$ = [Node('~@', ''), $2];}
	;

backtick
	: BACKTICK exp
		{$$ = [Node('`'), $2];}
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

id
	: ID
		{$$ = Node('id', yytext);}
	;

mcall
	: MCALL
		{$$ = Node('mcall', yytext);}
	;

propaccess
	: PROPACCESS
		{$$ = Refprop('refprop', yytext);}
	;
