// Transcrypt'ed from Python
import {AssertionError, AttributeError, BaseException, DeprecationWarning, Exception, IndexError, IterableError, KeyError, NotImplementedError, RuntimeWarning, StopIteration, UserWarning, ValueError, Warning, __JsIterator__, __PyIterator__, __Terminal__, __add__, __and__, __call__, __class__, __envir__, __eq__, __floordiv__, __ge__, __get__, __getcm__, __getitem__, __getslice__, __getsm__, __gt__, __i__, __iadd__, __iand__, __idiv__, __ijsmod__, __ilshift__, __imatmul__, __imod__, __imul__, __in__, __init__, __ior__, __ipow__, __irshift__, __isub__, __ixor__, __jsUsePyNext__, __jsmod__, __k__, __kwargtrans__, __le__, __lshift__, __lt__, __matmul__, __mergefields__, __mergekwargtrans__, __mod__, __mul__, __ne__, __neg__, __nest__, __or__, __pow__, __pragma__, __pyUseJsNext__, __rshift__, __setitem__, __setproperty__, __setslice__, __sort__, __specialattrib__, __sub__, __super__, __t__, __terminal__, __truediv__, __withblock__, __xor__, abs, all, any, assert, bool, bytearray, bytes, callable, chr, copy, deepcopy, delattr, dict, dir, divmod, enumerate, filter, float, getattr, hasattr, input, int, isinstance, issubclass, len, list, map, max, min, object, ord, pow, print, property, py_TypeError, py_iter, py_metatype, py_next, py_reversed, py_typeof, range, repr, round, set, setattr, sorted, str, sum, tuple, zip} from './org.transcrypt.__runtime__.js';
var __name__ = '__main__';
function compare(a, b) {
    if (typeof a === 'string' && typeof b === 'string') {
        return a.localeCompare(b);
    } else if (typeof a === 'number' && typeof b === 'number') {
        return a - b;
    } else if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return a.length - b.length;
        } else {
            for (let i = 0; i < a.length; i++) {
                const comparison = compare(a[i], b[i]);
                if (comparison !== 0) {
                    return comparison;
                }
            }
            return 0;
        }
    } else {
        throw new Error('Cannot compare different types');
    }
}

export var heappush = function (heap, item) {
	heap.append (item);
	_siftdown (heap, 0, len (heap) - 1);
};
export var heappop = function (heap) {
	var lastelt = heap.py_pop ();
	if (heap) {
		var returnitem = heap [0];
		heap [0] = lastelt;
		_siftup (heap, 0);
		return returnitem;
	}
	return lastelt;
};
export var heapreplace = function (heap, item) {
	var returnitem = heap [0];
	heap [0] = item;
	_siftup (heap, 0);
	return returnitem;
};
export var heappushpop = function (heap, item) {
	if (heap && heap [0] < item) {
		var __left0__ = tuple ([heap [0], item]);
		var item = __left0__ [0];
		heap [0] = __left0__ [1];
		_siftup (heap, 0);
	}
	return item;
};
export var heapify = function (x) {
	var n = len (x);
	for (var i of py_reversed (range (Math.floor (n / 2)))) {
		_siftup (x, i);
	}
};
export var _heappop_max = function (heap) {
	var lastelt = heap.py_pop ();
	if (heap) {
		var returnitem = heap [0];
		heap [0] = lastelt;
		_siftup_max (heap, 0);
		return returnitem;
	}
	return lastelt;
};
export var _heapreplace_max = function (heap, item) {
	var returnitem = heap [0];
	heap [0] = item;
	_siftup_max (heap, 0);
	return returnitem;
};
export var _heapify_max = function (x) {
	var n = len (x);
	for (var i of py_reversed (range (Math.floor (n / 2)))) {
		_siftup_max (x, i);
	}
};
export var _siftdown = function (heap, startpos, pos) {
	var newitem = heap [pos];
	while (pos > startpos) {
		var parentpos = pos - 1 >> 1;
		var parent = heap [parentpos];
		if (compare(parent, newitem) > 0) {
			heap [pos] = parent;
			var pos = parentpos;
			continue;
		}
		break;
	}
	heap [pos] = newitem;
};
export var _siftup = function (heap, pos) {
	var endpos = len (heap);
	var startpos = pos;
	var newitem = heap [pos];
	var childpos = 2 * pos + 1;
	while (childpos < endpos) {
		var rightpos = childpos + 1;
		if (rightpos < endpos && !(compare(heap[childpos], heap[rightpos]) < 0)) {
			var childpos = rightpos;
		}
		heap [pos] = heap [childpos];
		var pos = childpos;
		var childpos = 2 * pos + 1;
	}
	heap [pos] = newitem;
	_siftdown (heap, startpos, pos);
};
export var _siftdown_max = function (heap, startpos, pos) {
	var newitem = heap [pos];
	while (pos > startpos) {
		var parentpos = pos - 1 >> 1;
		var parent = heap [parentpos];
		if (parent < newitem) {
			heap [pos] = parent;
			var pos = parentpos;
			continue;
		}
		break;
	}
	heap [pos] = newitem;
};
export var _siftup_max = function (heap, pos) {
	var endpos = len (heap);
	var startpos = pos;
	var newitem = heap [pos];
	var childpos = 2 * pos + 1;
	while (childpos < endpos) {
		var rightpos = childpos + 1;
		if (rightpos < endpos && !(heap [rightpos] < heap [childpos])) {
			var childpos = rightpos;
		}
		heap [pos] = heap [childpos];
		var pos = childpos;
		var childpos = 2 * pos + 1;
	}
	heap [pos] = newitem;
	_siftdown_max (heap, startpos, pos);
};
export var merge = function* (reverse) {
	var iterables = tuple ([].slice.apply (arguments).slice (1));
	var h_append = function (x) {
		h.append (x);
	};
	var h = [];
	if (reverse) {
		var _heapify = _heapify_max;
		var _heappop = _heappop_max;
		var _heapreplace = _heapreplace_max;
		var direction = -(1);
	}
	else {
		var _heapify = heapify;
		var _heappop = heappop;
		var _heapreplace = heapreplace;
		var direction = 1;
	}
	for (var [order, it] of enumerate (map (py_iter, iterables))) {
		try {
			var py_next = it.__next__;
			h_append ([py_next (), order * direction, py_next]);
		}
		catch (__except0__) {
			if (isinstance (__except0__, StopIteration)) {
				// pass;
			}
			else {
				throw __except0__;
			}
		}
	}
	_heapify (h);
	while (len (h) > 1) {
		try {
			while (true) {
				var __left0__ = h [0];
				var value = __left0__ [0];
				var order = __left0__ [1];
				var py_next = __left0__ [2];
				var s = __left0__;
				yield value;
				s [0] = py_next ();
				_heapreplace (h, s);
			}
		}
		catch (__except0__) {
			if (isinstance (__except0__, StopIteration)) {
				_heappop (h);
			}
			else {
				throw __except0__;
			}
		}
	}
	if (h) {
		var __left0__ = h [0];
		var value = __left0__ [0];
		var order = __left0__ [1];
		var py_next = __left0__ [2];
		yield value;
		yield* py_next.__self__;
	}
	return };
export var nsmallest = function (n, iterable) {
	if (n == 1) {
		var it = py_iter (iterable);
		var sentinel = {};
		var result = min (it, __kwargtrans__ ({py_default: sentinel}));
		return (result === sentinel ? [] : [result]);
	}
	try {
		var size = len (iterable);
		try {
			if (n >= size) {
				return sorted (iterable).__getslice__ (0, n, 1);
			}
		}
		catch (__except0__) {
		}
	}
	catch (__except0__) {
		if (isinstance (__except0__, tuple ([py_TypeError, AttributeError]))) {
			// pass;
		}
		else {
			throw __except0__;
		}
	}
	var it = py_iter (iterable);
	var result = (function () {
		var __accu0__ = [];
		for (var [i, elem] of zip (range (n), it)) {
			__accu0__.append (tuple ([elem, i]));
		}
		return __accu0__;
	}) ();
	if (!(result)) {
		return result;
	}
	_heapify_max (result);
	var top = result [0] [0];
	var order = n;
	var _heapreplace = _heapreplace_max;
	for (var elem of it) {
		if (elem < top) {
			_heapreplace (result, tuple ([elem, order]));
			var __left0__ = result [0];
			var top = __left0__ [0];
			var _order = __left0__ [1];
			order++;
		}
	}
	result.py_sort ();
	return (function () {
		var __accu0__ = [];
		for (var [elem, order] of result) {
			__accu0__.append (elem);
		}
		return __accu0__;
	}) ();
};
export var nlargest = function (n, iterable) {
	if (n == 1) {
		var it = py_iter (iterable);
		var sentinel = {};
		var result = max (it, __kwargtrans__ ({py_default: sentinel}));
		return (result === sentinel ? [] : [result]);
	}
	try {
		var size = len (iterable);
		try {
			if (n >= size) {
				return sorted (iterable, __kwargtrans__ ({reverse: true})).__getslice__ (0, n, 1);
			}
		}
		catch (__except0__) {
		}
	}
	catch (__except0__) {
		if (isinstance (__except0__, tuple ([py_TypeError, AttributeError]))) {
			// pass;
		}
		else {
			throw __except0__;
		}
	}
	var it = py_iter (iterable);
	var result = (function () {
		var __accu0__ = [];
		for (var [i, elem] of zip (range (0, -(n), -(1)), it)) {
			__accu0__.append (tuple ([elem, i]));
		}
		return __accu0__;
	}) ();
	if (!(result)) {
		return result;
	}
	heapify (result);
	var top = result [0] [0];
	var order = -(n);
	var _heapreplace = heapreplace;
	for (var elem of it) {
		if (top < elem) {
			_heapreplace (result, tuple ([elem, order]));
			var top = result [0] [0];
			var _order = result [0] [1];
			order--;
		}
	}
	result.py_sort (__kwargtrans__ ({reverse: true}));
	return (function () {
		var __accu0__ = [];
		for (var [elem, order] of result) {
			__accu0__.append (elem);
		}
		return __accu0__;
	}) ();
};
export var assert_value_equal = function (a, b) {
	if (!(Math.abs(a - b) <= 0.0001)) {
		throw new Error("Assertion failed: abs(a - b) <= 0.0001");
	}
};
export var assert_equal = function (a, b) {
	for (var [i, j] of zip (a, b)) {
		assert_value_equal (i, j);
	}
};
export var test_heappush_help_function = function (py_items) {
	var heap = [];
	for (var item of py_items) {
		heappush (heap, item);
	}
	var a = heappop (heap);
	var b = heappop (heap);
	return [a, b];
};
export var test_heappush = function () {
	var tmp = test_heappush_help_function ([6, 1, -(2), 5]);
	assert_equal (tmp, [-(2), 1]);
	var tmp = test_heappush_help_function ([34, -(3), -(12), 0]);
	assert_equal (tmp, [-(12), -(3)]);
	var tmp = test_heappush_help_function ([5, 4, 3, 2, 1]);
	assert_equal (tmp, [1, 2]);
	var tmp = test_heappush_help_function ([4.7, 8, -(1.2), 7.2]);
	assert_equal (tmp, [-(1.2), 4.7]);
};
export var test_heapify_help_function = function (x) {
	heapify (x);
	var a = heappop (x);
	var b = heappop (x);
	return [a, b];
};
export var test_heapify = function () {
	var tmp = test_heapify_help_function ([6, 1, -(2), 5]);
	assert_equal (tmp, [-(2), 1]);
	var tmp = test_heapify_help_function ([34, -(3), -(12), 0]);
	assert_equal (tmp, [-(12), -(3)]);
	var tmp = test_heapify_help_function ([5, 4, 3, 2, 1]);
	assert_equal (tmp, [1, 2]);
	var tmp = test_heapify_help_function ([4.7, 8, -(1.2), 7.2]);
	assert_equal (tmp, [-(1.2), 4.7]);
};
export var test_heappushpop_help_function = function (x, i) {
	heapify (x);
	var a = heappushpop (x, i);
	return a;
};
export var test_heappushpop = function () {
	var tmp = test_heappushpop_help_function ([6, 1, -(2), 5], -(5));
	assert_value_equal (tmp, -(5));
	var tmp = test_heappushpop_help_function ([34, -(3), -(12), 0], -(13));
	assert_value_equal (tmp, -(13));
	var tmp = test_heappushpop_help_function ([5, 4, 3, 2, 1], 0);
	assert_value_equal (tmp, 0);
	var tmp = test_heappushpop_help_function ([4.7, 8, -(1.2), 7.2], 9);
	assert_value_equal (tmp, -(1.2));
};
export var test_heapreplace_help_function = function (x, i) {
	heapify (x);
	var a = heapreplace (x, i);
	var b = heappop (x);
	return [a, b];
};
export var test_heapreplace = function () {
	var tmp = test_heapreplace_help_function ([6, 1, -(2), 5], -(5));
	assert_equal (tmp, [-(2), -(5)]);
	var tmp = test_heapreplace_help_function ([34, -(3), -(12), 0], -(13));
	assert_equal (tmp, [-(12), -(13)]);
	var tmp = test_heapreplace_help_function ([5, 4, 3, 2, 1], 0);
	assert_equal (tmp, [1, 0]);
	var tmp = test_heapreplace_help_function ([4.7, 8, -(1.2), 7.2], 9);
	assert_equal (tmp, [-(1.2), 4.7]);
};
export var test_merge = function () {
	var tmp = list (merge (false, [1, 3, 5, 7], [0, 2, 4, 8], [5, 10, 15, 20], [], [25]));
	assert_equal (tmp, [0, 1, 2, 3, 4, 5, 5, 7, 8, 10, 15, 20, 25]);
	var tmp = list (merge (true, [7, 5, 3, 1], [8, 4, 2, 0]));
	assert_equal (tmp, [8, 7, 5, 4, 3, 2, 1, 0]);
};
export var test_nsmallest = function () {
	var tmp = nsmallest (1, [6, 1, -(2), 5]);
	assert_equal (tmp, [-(2)]);
	var tmp = nsmallest (2, [34, -(3), -(12), 0]);
	assert_equal (tmp, [-(12), -(3)]);
	var tmp = nsmallest (2, [5, 4, 3, 2, 1]);
	assert_equal (tmp, [1, 2]);
	var tmp = nsmallest (2, [4.7, 8, -(1.2), 7.2]);
	assert_equal (tmp, [-(1.2), 4.7]);
};
export var test_nlargest = function () {
	var tmp = nlargest (1, [6, 1, -(2), 5]);
	assert_equal (tmp, [6]);
	var tmp = nlargest (2, [34, -(3), -(12), 0]);
	assert_equal (tmp, [34, 0]);
	var tmp = nlargest (2, [5, 4, 3, 2, 1]);
	assert_equal (tmp, [5, 4]);
	var tmp = nlargest (2, [4.7, 8, -(1.2), 7.2]);
	assert_equal (tmp, [8, 7.2]);
};
export var test = function () {
	test_heappush ();
	test_heapify ();
	test_heappushpop ();
	test_heapreplace ();
	test_nsmallest ();
	test_nlargest ();
	test_merge ();
	additional_tests ();
};
export var additional_tests = function () {
	var heap = [1];
	var tmp = heappop (heap);
	assert_value_equal (tmp, 1);
	var heap = [1];
	var tmp = _heappop_max (heap);
	assert_value_equal (tmp, 1);
	var tmp = nsmallest (0, [1]);
	assert_equal (tmp, []);
	var tmp = nsmallest (2, []);
	assert_equal (tmp, []);
	var tmp = nsmallest (0, zip ([], [1]));
	assert_equal (tmp, []);
	var tmp = nlargest (0, [1]);
	assert_equal (tmp, []);
	var tmp = nlargest (2, []);
	assert_equal (tmp, []);
	var tmp = nlargest (0, zip ([], [1]));
	assert_equal (tmp, []);
	var heap = [1, 2, 3];
	var tmp = _siftup_max (heap, 0);
	assert_equal (heap, [3, 2, 1]);
};
test ();

//# sourceMappingURL=source.map