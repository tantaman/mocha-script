/*
jison grammar.jison tokens.jisonlex 
// TODO: Call a backend that can generate any language
// instead of genreating javascript directly in the parser.
*/

%{
	function paramStr(a1, a2) {
		if (a2 != '')
			return a1 + "," + a2;
		else
			return a1;
	}

	function sexpStr(a1, a2) {
		if (a2 != '')
			return a1 + ";\n" + a2 + ";";
		else
			return a1 + ";\n";
	}
%}

%%

pgm
	: explist ENDOFFILE
		{return "(function() {" + $1 + "})();";}
	;

explist
	: explisti
		{
			var list = $1;
			list[list.length - 1] = "return " + list[list.length - 1];
			$$ = list.join(";\n");
		}
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
		{$$ = "(" + $2 + ")(" + $3 + ")";}
	| LPAREN NEW id params RPAREN
		{$$ = "new " + $3 + "(" + $4 + ")"}
	| LPAREN id params RPAREN
		{$$ = $2 + "(" + $3 + ")"}
	| LPAREN mathy params RPAREN
		{
			var fn;
			var binaryRep = $2;
			var unaryRep;
			switch($2) {
			case '=':
				fn = 'eq';
				binaryRep = '===';
				break;
			case '+':
				fn = 'plus';
				break;
			case '-':
				fn = 'minus';
				break;
			case '*':
				fn = 'mult';
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
			case '/':
				fn = 'divide';
				break;
			case 'not':
				unaryRep = '!';
				break;
			}

			// TODO: another example of why we need to build a graph of nodes first.
			var split = $3.split(",");
			var count = split.length;
			if (unaryRep) {
				$$ = unaryRep + $3[0];
			} else if (count == 2) {
				$$ = '(' + split[0] + binaryRep + split[1] + ')';
			} else if(count == 1) {
				$$ = 'u' + fn + "(" + $3 + ")";
			} else {
				$$ = fn + ".call(null, " + $3 + ")";
			}
		}
	;

mathy
	: MATHY
		{$$ = $1}
	;

params
	: exp params
		{$$ = paramStr($1, $2);}
	|
		{$$ = '';}
	;

sloop
	: LPAREN LOOP LPAREN letparams RPAREN explisti RPAREN
		{
		var lastExp = $6[$6.length-1];
		$6[$6.length-1] = "__loopResult = " + lastExp;
		$6 = $6.join("\n;");
		$$ = "(function() { var __looping, __loopResult; "
		+ $4 + "\n"
		+ "do { "
		+ "__looping = false;\n"
		+ $6 
		+ "} while(__looping);\n"
		+ "return __loopResult;})()"}
	;

srecur
	: LPAREN RECUR recurparams RPAREN
		{$$ = "(__looping = true) && false";
		if ($3 != '') $$ += " || " + $3;}
	;

recurparams
	: id exp recurparams
		{$$ = "(" + $1 + " = " + $2 + ") && false";
		if ($3 != '') $$ += " || " + $3;}
	|
		{$$ = '';}
	;

slet
	: LPAREN LET LPAREN letparams RPAREN explist RPAREN
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
		{$$ = "{" + $2 + "}"}
	;

jskeyvalpairs
	: jskey COLON exp jskeyvalpairs
		{$$ = $1 + ":" + paramStr($3, $4);}
	|
		{$$ = '';}
	;

jskey
	: id
		{$$ = $1}
	| STRING
		{$$ = yytext}
	;

jsarray
	: LBRACKET jsarrayentries RBRACKET
		{$$ = "[" + $2 + "]"}
	;

jsarrayentries
	: exp jsarrayentries
		{$$ = paramStr($1, $2);}
	|
		{$$ = '';}
	;

sswitch
	: LPAREN SWITCH exp caselist RPAREN
		{$$ = "(function() {\n var __res; switch (" + $3 + ") {\n" + $4 + "\n}\n return __res;})()";}
	;

caselist
	: exp exp caselist
		{$$ = "case " + $1 + ":\n\t (__res = " + $2 + ") break;\n" + $3;}
	|
		{$$ = '';}
	;

sset
	: LPAREN SET id exp RPAREN
		{$$ = "(" + $3 + " = " + $4 + ")";}
	| LPAREN SET sprop exp RPAREN
		{$$ = "(" + $3 + " = " + $4 + ")";}
	;

sdef
	: LPAREN DEF id exp RPAREN
		{$$ = "var " + $3 + " = " + $4 + "\n";}
	;

smcall
	: LPAREN mcall exp params RPAREN
		{$$ = "(" + $3 + ")" + $2 + "(" + $4 + ")";}
	;

sprop
	: LPAREN propaccess exp RPAREN
		{$$ = "(" + $3 + ")." + $2;}
	;

sfn
	: LPAREN FN LPAREN fnparams RPAREN explist RPAREN
		{$$ = "\nfunction(" + $4 + ") {\n" + $6 + "\n}\n";}
	;

fnparams
	: id fnparams
		{$$ = paramStr($1, $2);}
	|
		{$$ = '';}
	;

id
	: ID
		{$$ = yytext;}
	;

mcall
	: MCALL
		{$$ = yytext;}
	;

propaccess
	: PROPACCESS
		{$$ = yytext.substring(1);}
	;
