number                      [-]?[0-9]*\.?[0-9]+
id                          [a-zA-Z$_!][a-zA-Z0-9$_!.]*
mcall                  		\.[a-zA-Z$_!][a-zA-Z0-9$_!.]*
propaccess                  \:[a-zA-Z$_!][a-zA-Z0-9$_!.]*

%%
";".*                       /* ignore comments */
"("                         return 'LPAREN';
")"                         return 'RPAREN';
"~"							return 'TILDE';
"`"							return 'BACKTICK';
\"[^"]*\"                   return 'STRING';
\'[^']*\'                   return 'STRING';
{number}                    return 'NUMBER';
"not"						return 'MATHY';
{mcall}               		return 'MCALL';
{propaccess}                return 'PROPACCESS';
{id}                        return 'ID';
":"                         return 'COLON';
","                         return 'COMMA';
"{"                         return 'LCURLY';
"}"                         return 'RCURLY';
"["                         return 'LBRACKET';
"]"                         return 'RBRACKET';
"="                         return 'MATHY';
"+"                         return 'MATHY';
"-"                         return 'MATHY';
"*"                         return 'MATHY';
">"                         return 'MATHY';
"<"                         return 'MATHY';
">="                        return 'MATHY';
"<="                        return 'MATHY';
"/"                         return 'MATHY';
\s+                         /* skip whitespace */
<<EOF>>                     return 'ENDOFFILE';
