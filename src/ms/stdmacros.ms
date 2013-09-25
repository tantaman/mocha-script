; (!! expr :prop expr)
(defmacro !! (syms)
	`(let (obj ~(get syms 1) newValue ~(get syms 3) oldValue (~(get syms 2) obj))
		(! (~(get syms 2) obj) newValue)
		(msdispatch.propChange obj ~(get syms 2) newValue oldValue)
		newValue
	))

;(assoc! exp key val)
(defmacro assoc! (syms)
	`(let (obj ~(get syms 1))
		(! obj ~(get syms 2) ~(get syms 3))
		obj))

;(obj (meth1 (params) body) (meth2 (params) body) (prop: value))
;{meth1: (fn (params) body) prop: value}
(defmacro obj (syms)
	(let (
		values (map 
			(fn (prop) (if (= prop.length 2)
				(1 prop)
				`(fn ~(1 prop) ~(rest prop 2))))
			(rest syms))
		keys (map (fn (prop) (0 prop)) (rest syms)))
		(.concat [(Node "jsobject")] (flatten (zip keys values) true))
	))
