; (!! expr :prop expr)
(defmacro !! (syms)
	`(let (obj ~(get syms 1) newValue ~(get syms 3) oldValue (~(get syms 2) obj))
		(! (~(get syms 2) obj) newValue)
		(if (not (= newValue oldValue))
			(msdispatch.propChange obj ~(get syms 2) newValue oldValue))
		newValue
	))