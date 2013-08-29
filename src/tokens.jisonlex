number						[-]?[0-9]*\.?[0-9]+
id                          [a-zA-Z$_][a-zA-Z0-9$_]*
propaccess                  \.[a-zA-Z$_][a-zA-Z0-9$_]*

%%
";".*						/* ignore comments */
"("							return 'LPAREN';
")"							return 'RPAREN';
"!"							return 'SET';
\"[^"]*\"					return 'STRING';
{number}					return 'NUMBER';
"let"						return 'LET';
"if"						return 'IF';
"switch"					return 'SWITCH';
"fn"						return 'FN';
{propaccess}				return 'PROPACCESS';
{id}						return 'ID';
"="                         return 'MATHY';
"+"                         return 'MATHY';
"-"                         return 'MATHY';
"*"                         return 'MATHY';
">"                         return 'MATHY';
"<"							return 'MATHY';
">="						return 'MATHY';
"<="						return 'MATHY';
\s+                         /* skip whitespace */
<<EOF>>						return 'ENDOFFILE';
