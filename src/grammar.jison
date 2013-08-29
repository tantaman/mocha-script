/*
jison grammar.jison tokens.jisonlex 
*/

%{
	function paramStr(a1, a2) {
		if (a2)
			return a1 + "," + a2;
		else
			return a1;
	}
%}

%%

pgm
	: sexplist ENDOFFILE
		{console.log($1);}
	;

sexplist
	: sexp sexplist 
		{$$ = $1 + "\n" + $2;}
	|
		{$$ = '';}
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
	| sfn
		{$$ = $1;}
	| LPAREN id params RPAREN
		{$$ = $1 + "(" + $2 + ")"}
	| LPAREN mathy params RPAREN
		{
			var fn;
			switch($2) {
			case '=':
				fn = 'equal';
				break;
			case '+':
				fn = 'plus';
				break;
			case '-':
				fn = 'minus';
				break;
			case '*':
				fn = 'times';
				break;
			case '>':
				fn = 'gt';
				break;
			case '<':
				fn = 'lt';
				break;
			case '>=':
				fn = 'gte';
				break;
			case '<=':
				fn = 'lte';
				break;
			}

			$$ = fn + ".call(null, " + $params + ")";
		}
	;

mathy
	: MATHY
		{$$ = $1}
	;

params
	: sexp params
		{$$ = paramStr($1, $2);}
	| id params
		{$$ = paramStr($1, $2);}
	| STRING params
		{$$ = paramStr($1, $2);}
	| NUMBER params
		{$$ = paramStr($1, $2);}
	|
		{$$ = '';}
	;

/*TODO: we are going to have to actually build up a graph of nodes
so we can do lets efficiently and correclty handle variable hoisting
and other problems of JS scoping.
This naive approach, while it'll get things working, isn't going to work
in the long run.*/
slet
	: LPAREN LET LPAREN letparams RPAREN sexplist RPAREN
		{$$ = "(function() { " + $4 + "\n" + $6 + "\n})()";}
	;

letparams
	: id exp letparams
		{$$ = "var " + $1 + " = " + $2 + ";\n" + $3;}
	|
		{$$ = '';}
	;

sif
	: LPAREN IF exp exp RPAREN
		{$$ = "(" + $3 + " ? " + $4 + " : null)\n";}
	| LPAREN IF exp exp exp RPAREN
		{$$ = "(" + $3 + " ? " + $4 + " : " + $5 + ")\n";}
	;

exp
	: id
		{$$ = $1;}
	| NUMBER
		{$$ = yytext;}
	| STRING
		{$$ = yytext;}
	| sexp
		{$$ = $1;}
	;

/*TODO: switch statements needs optimization.  This will kill us if they are run in a loop*/
sswitch
	: LPAREN SWITCH exp caselist RPAREN
		{$$ = "(function() {\n var __res; switch (" + $3 + ") {\n" + $4 + "\n}\n return __res;})()";}
	;

caselist
	: exp exp caselist
		{$$ = "case " + $1 + ":\n\t" + __res = $2 + "break;\n" + $3;}
	|
		{$$ = '';}
	;

sset
	: LPAREN SET id exp RPAREN
		{$$ = "(" + $3 + " = " + $4 + ")";}
	| LPAREN SET sprop exp RPAREN
		{$$ = "(" + $3 + " = " + $4 + ")";}
	;

sprop
	: LPAREN propaccess exp RPAREN
		{$$ = "(" + $3 + ")" + $2;}
	;

sfn
	: LPAREN FN LPAREN fnparams RPAREN sexplist RPAREN
		{$$ = "\nfunction(" + $4 + ") {\n" + $6 + "\n}\n";}
	;

fnparams
	: id fnparams
		{$$ = $1 + ',' + $2;}
	|
		{$$ = '';}
	;

id
	: ID
		{$$ = yytext;}
	;

propaccess
	: PROPACCESS
		{$$ = yytext;}
	;
