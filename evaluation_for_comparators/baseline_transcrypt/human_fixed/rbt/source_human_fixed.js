// Transcrypt'ed from Python
import {AssertionError, AttributeError, BaseException, DeprecationWarning, Exception, IndexError, IterableError, KeyError, NotImplementedError, RuntimeWarning, StopIteration, UserWarning, ValueError, Warning, __JsIterator__, __PyIterator__, __Terminal__, __add__, __and__, __call__, __class__, __envir__, __eq__, __floordiv__, __ge__, __get__, __getcm__, __getitem__, __getslice__, __getsm__, __gt__, __i__, __iadd__, __iand__, __idiv__, __ijsmod__, __ilshift__, __imatmul__, __imod__, __imul__, __in__, __init__, __ior__, __ipow__, __irshift__, __isub__, __ixor__, __jsUsePyNext__, __jsmod__, __k__, __kwargtrans__, __le__, __lshift__, __lt__, __matmul__, __mergefields__, __mergekwargtrans__, __mod__, __mul__, __ne__, __neg__, __nest__, __or__, __pow__, __pragma__, __pyUseJsNext__, __rshift__, __setitem__, __setproperty__, __setslice__, __sort__, __specialattrib__, __sub__, __super__, __t__, __terminal__, __truediv__, __withblock__, __xor__, abs, all, any, assert, bool, bytearray, bytes, callable, chr, copy, deepcopy, delattr, dict, dir, divmod, enumerate, filter, float, getattr, hasattr, input, int, isinstance, issubclass, len, list, map, max, min, object, ord, pow, print, property, py_TypeError, py_iter, py_metatype, py_next, py_reversed, py_typeof, range, repr, round, set, setattr, sorted, str, sum, tuple, zip} from './org.transcrypt.__runtime__.js';
// import {annotations} from './__future__.js';
var __name__ = '__main__';
export var RedBlackTree =  __class__ ('RedBlackTree', [object], {
	__module__: __name__,
	get __init__ () {return __get__ (this, function (self, label, color, parent, left, right) {
		if (typeof label == 'undefined' || (label != null && label.hasOwnProperty ("__kwargtrans__"))) {;
			var label = null;
		};
		if (typeof color == 'undefined' || (color != null && color.hasOwnProperty ("__kwargtrans__"))) {;
			var color = 0;
		};
		if (typeof parent == 'undefined' || (parent != null && parent.hasOwnProperty ("__kwargtrans__"))) {;
			var parent = null;
		};
		if (typeof left == 'undefined' || (left != null && left.hasOwnProperty ("__kwargtrans__"))) {;
			var left = null;
		};
		if (typeof right == 'undefined' || (right != null && right.hasOwnProperty ("__kwargtrans__"))) {;
			var right = null;
		};
		self.label = label;
		self.parent = parent;
		self.left = left;
		self.right = right;
		self.color = color;
	});},
	get rotate_left () {return __get__ (this, function (self) {
		var parent = self.parent;
		var right = self.right;
		if (right === null) {
			return self;
		}
		self.right = right.left;
		if (self.right) {
			self.right.parent = self;
		}
		self.parent = right;
		right.left = self;
		if (parent !== null) {
			if (parent.left.equals(self)) {
				parent.left = right;
			}
			else {
				parent.right = right;
			}
		}
		right.parent = parent;
		return right;
	});},
	get rotate_right () {return __get__ (this, function (self) {
		if (self.left === null) {
			return self;
		}
		var parent = self.parent;
		var left = self.left;
		self.left = left.right;
		if (self.left) {
			self.left.parent = self;
		}
		self.parent = left;
		left.right = self;
		if (parent !== null) {
			if (parent.right.equals(self)) {
				parent.right = left;
			}
			else {
				parent.left = left;
			}
		}
		left.parent = parent;
		return left;
	});},
	get insert () {return __get__ (this, function (self, label) {
		if (self.label === null) {
			self.label = label;
			return self;
		}
		if (self.label == label) {
			return self;
		}
		else if (self.label > label) {
			if (self.left !== null) {
				self.left.insert (label);
			}
			else {
				self.left = RedBlackTree (label, 1, self);
				self.left._insert_repair ();
			}
		}
		else if (self.right !== null) {
			self.right.insert (label);
		}
		else {
			self.right = RedBlackTree (label, 1, self);
			self.right._insert_repair ();
		}
		return self.parent || self;
	});},
	get _insert_repair () {return __get__ (this, function (self) {
		if (self.parent === null) {
			self.color = 0;
		}
		else if (get_color (self.parent) == 0) {
			self.color = 1;
		}
		else {
			var uncle = self.parent.sibling;
			if (get_color (uncle) == 0) {
				if (self.is_left () && self.parent.is_right ()) {
					self.parent.rotate_right ();
					if (self.right) {
						self.right._insert_repair ();
					}
				}
				else if (self.is_right () && self.parent.is_left ()) {
					self.parent.rotate_left ();
					if (self.left) {
						self.left._insert_repair ();
					}
				}
				else if (self.is_left ()) {
					if (self.grandparent) {
						self.grandparent.rotate_right ();
						self.parent.color = 0;
					}
					if (self.parent.right) {
						self.parent.right.color = 1;
					}
				}
				else {
					if (self.grandparent) {
						self.grandparent.rotate_left ();
						self.parent.color = 0;
					}
					if (self.parent.left) {
						self.parent.left.color = 1;
					}
				}
			}
			else {
				self.parent.color = 0;
				if (uncle && self.grandparent) {
					uncle.color = 0;
					self.grandparent.color = 1;
					self.grandparent._insert_repair ();
				}
			}
		}
	});},
	get remove () {return __get__ (this, function (self, label) {
		if (self.label == label) {
			if (self.left && self.right) {
				var value = self.left.get_max ();
				if (value !== null) {
					self.label = value;
					self.left.remove (value);
				}
			}
			else {
				var child = self.left || self.right;
				if (self.color == 1) {
					if (self.parent) {
						if (self.is_left ()) {
							self.parent.left = null;
						}
						else {
							self.parent.right = null;
						}
					}
				}
				else if (child === null) {
					if (self.parent === null) {
						return RedBlackTree (null);
					}
					else {
						self._remove_repair ();
						if (self.is_left ()) {
							self.parent.left = null;
						}
						else {
							self.parent.right = null;
						}
						self.parent = null;
					}
				}
				else {
					self.label = child.label;
					self.left = child.left;
					self.right = child.right;
					if (self.left) {
						self.left.parent = self;
					}
					if (self.right) {
						self.right.parent = self;
					}
				}
			}
		}
		else if (self.label !== null && self.label > label) {
			if (self.left) {
				self.left.remove (label);
			}
		}
		else if (self.right) {
			self.right.remove (label);
		}
		return self.parent || self;
	});},
	get _remove_repair () {return __get__ (this, function (self) {
		if (self.parent === null || self.sibling === null || self.parent.sibling === null || self.grandparent === null) {
			return ;
		}
		if (get_color (self.sibling) == 1) {
			self.sibling.color = 0;
			self.parent.color = 1;
			if (self.is_left ()) {
				self.parent.rotate_left ();
			}
			else {
				self.parent.rotate_right ();
			}
		}
		if (get_color (self.parent) == 0 && get_color (self.sibling) == 0 && get_color (self.sibling.left) == 0 && get_color (self.sibling.right) == 0) {
			self.sibling.color = 1;
			self.parent._remove_repair ();
			return ;
		}
		if (get_color (self.parent) == 1 && get_color (self.sibling) == 0 && get_color (self.sibling.left) == 0 && get_color (self.sibling.right) == 0) {
			self.sibling.color = 1;
			self.parent.color = 0;
			return ;
		}
		if (self.is_left () && get_color (self.sibling) == 0 && get_color (self.sibling.right) == 0 && get_color (self.sibling.left) == 1) {
			self.sibling.rotate_right ();
			self.sibling.color = 0;
			if (self.sibling.right) {
				self.sibling.right.color = 1;
			}
		}
		if (self.is_right () && get_color (self.sibling) == 0 && get_color (self.sibling.right) == 1 && get_color (self.sibling.left) == 0) {
			self.sibling.rotate_left ();
			self.sibling.color = 0;
			if (self.sibling.left) {
				self.sibling.left.color = 1;
			}
		}
		if (self.is_left () && get_color (self.sibling) == 0 && get_color (self.sibling.right) == 1) {
			self.parent.rotate_left ();
			self.grandparent.color = self.parent.color;
			self.parent.color = 0;
			self.parent.sibling.color = 0;
		}
		if (self.is_right () && get_color (self.sibling) == 0 && get_color (self.sibling.left) == 1) {
			self.parent.rotate_right ();
			self.grandparent.color = self.parent.color;
			self.parent.color = 0;
			self.parent.sibling.color = 0;
		}
	});},
	get check_color_properties () {return __get__ (this, function (self) {
		if (self.color) {
			print ('Property 2');
			return false;
		}
		if (!(self.check_coloring ())) {
			print ('Property 4');
			return false;
		}
		if (self.black_height () === null) {
			print ('Property 5');
			return false;
		}
		return true;
	});},
	get check_coloring () {return __get__ (this, function (self) {
		if (self.color == 1 && __in__ (1, tuple ([get_color (self.left), get_color (self.right)]))) {
			return false;
		}
		if (self.left && !(self.left.check_coloring ())) {
			return false;
		}
		if (self.right && !(self.right.check_coloring ())) {
			return false;
		}
		return true;
	});},
	get black_height () {return __get__ (this, function (self) {
		if (self === null || self.left === null || self.right === null) {
			return 1;
		}
		var left = self.left.black_height ();
		var right = self.right.black_height ();
		if (left === null || right === null) {
			return null;
		}
		if (left != right) {
			return null;
		}
		return left + (1 - self.color);
	});},
	get __contains__ () {return __get__ (this, function (self, label) {
		return self.search (label) !== null;
	});},
	get search () {return __get__ (this, function (self, label) {
		if (self.label == label) {
			return self;
		}
		else if (self.label !== null && label > self.label) {
			if (self.right === null) {
				return null;
			}
			else {
				return self.right.search (label);
			}
		}
		else if (self.left === null) {
			return null;
		}
		else {
			return self.left.search (label);
		}
	});},
	get floor () {return __get__ (this, function (self, label) {
		if (self.label == label) {
			return self.label;
		}
		else if (self.label !== null && self.label > label) {
			if (self.left) {
				return self.left.floor (label);
			}
			else {
				return null;
			}
		}
		else {
			if (self.right) {
				var attempt = self.right.floor (label);
				if (attempt !== null) {
					return attempt;
				}
			}
			return self.label;
		}
	});},
	get ceil () {return __get__ (this, function (self, label) {
		if (self.label == label) {
			return self.label;
		}
		else if (self.label !== null && self.label < label) {
			if (self.right) {
				return self.right.ceil (label);
			}
			else {
				return null;
			}
		}
		else {
			if (self.left) {
				var attempt = self.left.ceil (label);
				if (attempt !== null) {
					return attempt;
				}
			}
			return self.label;
		}
	});},
	get get_max () {return __get__ (this, function (self) {
		if (self.right) {
			return self.right.get_max();
		}
		else {
			return self.label;
		}
	});},
	get get_min () {return __get__ (this, function (self) {
		if (self.left) {
			return self.left.get_min();
		}
		else {
			return self.label;
		}
	});},
	get _get_grandparent () {return __get__ (this, function (self) {
		if (self.parent === null) {
			return null;
		}
		else {
			return self.parent.parent;
		}
	});},
	get _get_sibling () {return __get__ (this, function (self) {
		if (self.parent === null) {
			return null;
		}
		else if (self.parent.left === self) {
			return self.parent.right;
		}
		else {
			return self.parent.left;
		}
	});},
	get is_left () {return __get__ (this, function (self) {
		if (self.parent === null) {
			return false;
		}
		return (self.parent.left === self.parent.left && self.parent.left === self);
	});},
	get is_right () {return __get__ (this, function (self) {
		if (self.parent === null) {
			return false;
		}
		return self.parent.right === self;
	});},
	get __bool__ () {return __get__ (this, function (self) {
		return true;
	});},
	get __len__ () {return __get__ (this, function (self) {
		var ln = 1;
		if (self.left) {
			ln += self.__len__ (self.left);
		}
		if (self.right) {
			ln += self.__len__ (self.right);
		}
		return ln;
	});},
	get preorder_traverse () {return __get__ (this, function* (self) {
		yield self.label;
		if (self.left) {
			yield* self.left.preorder_traverse ();
		}
		if (self.right) {
			yield* self.right.preorder_traverse ();
		}
		});},
	get inorder_traverse () {return __get__ (this, function* (self) {
		if (self.left) {
			yield* self.left.inorder_traverse ();
		}
		yield self.label;
		if (self.right) {
			yield* self.right.inorder_traverse ();
		}
		});},
	get postorder_traverse () {return __get__ (this, function* (self) {
		if (self.left) {
			yield* self.left.postorder_traverse ();
		}
		if (self.right) {
			yield* self.right.postorder_traverse ();
		}
		yield self.label});},
	get equals () {return __get__ (this, function (self, other) {
		if (!(isinstance (other, RedBlackTree))) {
			return NotImplemented;
		}
		if (self.label === other.label) {
			return ((self.left && self.left.equals && self.left.equals(other.left)) || (!self.left || !self.left.equals && self.left === other.left)) && ((self.right && self.right.equals && self.right.equals(other.right)) || (!self.right || !self.right.equals && self.right === other.right));
		} else {
			return false;
		} 
	});}
});
Object.defineProperty (RedBlackTree, 'sibling', property.call (RedBlackTree, RedBlackTree._get_sibling));
Object.defineProperty (RedBlackTree, 'grandparent', property.call (RedBlackTree, RedBlackTree._get_grandparent));;
export var get_color = function (node) {
	if (node === null) {
		return 0;
	}
	else {
		return node.color;
	}
};
export var test_rotations = function () {
	var tree = RedBlackTree (0);
	tree.left = RedBlackTree (-(10), __kwargtrans__ ({parent: tree}));
	tree.right = RedBlackTree (10, __kwargtrans__ ({parent: tree}));
	tree.left.left = RedBlackTree (-(20), __kwargtrans__ ({parent: tree.left}));
	tree.left.right = RedBlackTree (-(5), __kwargtrans__ ({parent: tree.left}));
	tree.right.left = RedBlackTree (5, __kwargtrans__ ({parent: tree.right}));
	tree.right.right = RedBlackTree (20, __kwargtrans__ ({parent: tree.right}));
	var left_rot = RedBlackTree (10);
	left_rot.left = RedBlackTree (0, __kwargtrans__ ({parent: left_rot}));
	left_rot.left.left = RedBlackTree (-(10), __kwargtrans__ ({parent: left_rot.left}));
	left_rot.left.right = RedBlackTree (5, __kwargtrans__ ({parent: left_rot.left}));
	left_rot.left.left.left = RedBlackTree (-(20), __kwargtrans__ ({parent: left_rot.left.left}));
	left_rot.left.left.right = RedBlackTree (-(5), __kwargtrans__ ({parent: left_rot.left.left}));
	left_rot.right = RedBlackTree (20, __kwargtrans__ ({parent: left_rot}));
	var tree = tree.rotate_left ();
	if (!tree.equals(left_rot)) {
        return false;
    }
	var tree = tree.rotate_right ();
	var tree = tree.rotate_right ();
	var right_rot = RedBlackTree (-(10));
	right_rot.left = RedBlackTree (-(20), __kwargtrans__ ({parent: right_rot}));
	right_rot.right = RedBlackTree (0, __kwargtrans__ ({parent: right_rot}));
	right_rot.right.left = RedBlackTree (-(5), __kwargtrans__ ({parent: right_rot.right}));
	right_rot.right.right = RedBlackTree (10, __kwargtrans__ ({parent: right_rot.right}));
	right_rot.right.right.left = RedBlackTree (5, __kwargtrans__ ({parent: right_rot.right.right}));
	right_rot.right.right.right = RedBlackTree (20, __kwargtrans__ ({parent: right_rot.right.right}));
	if (!tree.equals(right_rot)) {
        return false;
    }
	return true;
};
export var test_insertion_speed = function () {
	var tree = RedBlackTree (-(1));
	for (var i = 0; i < 10; i++) {
		var tree = tree.insert (i);
	}
	return true;
};
export var test_insert = function () {
	var tree = RedBlackTree (0);
	tree.insert (8);
	tree.insert (-(8));
	tree.insert (4);
	tree.insert (12);
	tree.insert (10);
	tree.insert (11);
	var ans = RedBlackTree (0, 0);
	ans.left = RedBlackTree (-(8), 0, ans);
	ans.right = RedBlackTree (8, 1, ans);
	ans.right.left = RedBlackTree (4, 0, ans.right);
	ans.right.right = RedBlackTree (11, 0, ans.right);
	ans.right.right.left = RedBlackTree (10, 1, ans.right.right);
	ans.right.right.right = RedBlackTree (12, 1, ans.right.right);
	return tree.equals(ans);
};
export var test_insert_and_search = function () {
	var tree = RedBlackTree (0);
	tree.insert (8);
	tree.insert (-(8));
	tree.insert (4);
	tree.insert (12);
	tree.insert (10);
	tree.insert (11);
	if (__in__ (5, tree) || __in__ (-(6), tree) || __in__ (-(10), tree) || __in__ (13, tree)) {
		return false;
	}
	if (!(__in__ (11, tree) && __in__ (12, tree) && __in__ (-(8), tree) && __in__ (0, tree))) {
		return false;
	}
	return true;
};
export var test_insert_delete = function () {
	var tree = RedBlackTree (0);
	var tree = tree.insert (-(12));
	var tree = tree.insert (8);
	var tree = tree.insert (-(8));
	var tree = tree.insert (15);
	var tree = tree.insert (4);
	var tree = tree.insert (12);
	var tree = tree.insert (10);
	var tree = tree.insert (9);
	var tree = tree.insert (11);
	var tree = tree.remove (15);
	var tree = tree.remove (-(12));
	var tree = tree.remove (9);
	if (!(tree.check_color_properties ())) {
		return false;
	}
	if (Array.from(tree.inorder_traverse ()).toString() !== [-(8), 0, 4, 8, 10, 11, 12].toString()) {
		return false;
	}
	return true;
};
export var test_floor_ceil = function () {
	var tree = RedBlackTree (0);
	tree.insert (-(16));
	tree.insert (16);
	tree.insert (8);
	tree.insert (24);
	tree.insert (20);
	tree.insert (22);
	var tuples = [tuple ([-(20), null, -(16)]), tuple ([-(10), -(16), 0]), tuple ([8, 8, 8]), tuple ([50, 24, null])];
	for (var [val, floor, ceil] of tuples) {
		if (tree.floor (val) != floor || tree.ceil (val) != ceil) {
			return false;
		}
	}
	return true;
};
export var test_min_max = function () {
	var tree = RedBlackTree (0);
	tree.insert (-(16));
	tree.insert (16);
	tree.insert (8);
	tree.insert (24);
	tree.insert (20);
	tree.insert (22);
	if (tree.get_max () != 24 || tree.get_min () != -(16)) {
		return false;
	}
	return true;
};
export var test_tree_traversal = function () {
	var tree = RedBlackTree (0);
	var tree = tree.insert (-(16));
	tree.insert (16);
	tree.insert (8);
	tree.insert (24);
	tree.insert (20);
	tree.insert (22);
	if (Array.from(tree.inorder_traverse ()).toString() != [-(16), 0, 8, 16, 20, 22, 24].toString()) {
		return false;
	}
	if (Array.from(tree.preorder_traverse ()).toString() != [0, -(16), 16, 8, 22, 20, 24].toString()) {
		return false;
	}
	if (Array.from(tree.postorder_traverse ()).toString() != [-(16), 8, 20, 24, 22, 16, 0].toString()) {
		return false;
	}
	return true;
};
export var test_tree_chaining = function () {
	var tree = RedBlackTree (0);
	var tree = tree.insert (-(16)).insert (16).insert (8).insert (24).insert (20).insert (22);
	if (Array.from(tree.inorder_traverse ()).toString() != [-(16), 0, 8, 16, 20, 22, 24].toString()) {
		return false;
	}
	if (Array.from(tree.preorder_traverse ()).toString() != [0, -(16), 16, 8, 22, 20, 24].toString()) {
		return false;
	}
	if (Array.from(tree.postorder_traverse ()).toString() != [-(16), 8, 20, 24, 22, 16, 0].toString()) {
		return false;
	}
	return true;
};
export var print_results = function (msg, passes) {
	print (str (msg), (passes ? 'works!' : "doesn't work :|"));
};
export var test = function () {
	print_results ('Rotating right and left', test_rotations ());
	print_results ('Inserting', test_insert ());
	print_results ('Searching', test_insert_and_search ());
	print_results ('Deleting', test_insert_delete ());
	print_results ('Floor and ceil', test_floor_ceil ());
	print_results ('Min and max', test_min_max ());
	print_results ('Tree traversal', test_tree_traversal ());
	print_results ('Tree traversal', test_tree_chaining ());
	print ('Testing tree balancing...');
	print ('This should only be a few seconds.');
	test_insertion_speed ();
	additional_tests ();
	print ('Done!');
};
export var additional_tests = function () {
	var tree = RedBlackTree (0);
	var tree = RedBlackTree (0);
	tree.insert (-(16)).insert (16).insert (-(8)).insert (12);
	tree.insert (-(20)).insert (8).insert (-(4)).insert (4);
	tree.insert (-(3)).insert (24).insert (-(20)).insert (20);
	tree.insert (-(1)).insert (2).insert (-(3)).insert (3);
	tree.insert (10).insert (26);
	tree.right.right.left._remove_repair ();
};
test ();

//# sourceMappingURL=source.map