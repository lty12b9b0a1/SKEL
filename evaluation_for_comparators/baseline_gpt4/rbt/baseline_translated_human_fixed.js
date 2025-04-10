
class RedBlackTree {
    /**
     * A Red-Black tree, which is a self-balancing BST (binary search
     * tree).
     * This tree has similar performance to AVL trees, but the balancing is
     * less strict, so it will perform faster for writing/deleting nodes
     * and slower for reading in the average case, though, because they're
     * both balanced binary search trees, both will get the same asymptotic
     * performance.
     * To read more about them, https://en.wikipedia.org/wiki/Red-black_tree
     * Unless otherwise specified, all asymptotic runtimes are specified in
     * terms of the size of the tree.
     */

    constructor(label = null, color = 0, parent = null, left = null, right = null) {
        this.label = label;
        this.parent = parent;
        this.left = left;
        this.right = right;
        this.color = color;
    }

    // Here are functions which are specific to red-black trees

    rotate_left() {
        let parent = this.parent;
        let right = this.right;
        if (right === null) {
            return this;
        }
        this.right = right.left;
        if (this.right) {
            this.right.parent = this;
        }
        this.parent = right;
        right.left = this;
        if (parent !== null) {
            if (parent.left === this) {
                parent.left = right;
            } else {
                parent.right = right;
            }
        }
        right.parent = parent;
        return right;
    }

    rotate_right() {
        if (this.left === null) {
            return this;
        }
        let parent = this.parent;
        let left = this.left;
        this.left = left.right;
        if (this.left) {
            this.left.parent = this;
        }
        this.parent = left;
        left.right = this;
        if (parent !== null) {
            if (parent.right === this) {
                parent.right = left;
            } else {
                parent.left = left;
            }
        }
        left.parent = parent;
        return left;
    }

    insert(label) {
        if (this.label === null) {
            // Only possible with an empty tree
            this.label = label;
            return this;
        }
        if (this.label === label) {
            return this;
        } else if (this.label > label) {
            if (this.left) {
                this.left.insert(label);
            } else {
                this.left = new RedBlackTree(label, 1, this);
                this.left._insertRepair();
            }
        } else {
            if (this.right) {
                this.right.insert(label);
            } else {
                this.right = new RedBlackTree(label, 1, this);
                this.right._insertRepair();
            }
        }
        return this.parent || this;
    }

    _insertRepair() {
        /**Repair the coloring from inserting into a tree.*/
        if (this.parent === null) {
            // This node is the root, so it just needs to be black
            this.color = 0;
        } else if (getColor(this.parent) === 0) {
            this.color = 1;
        } else {
            let uncle = this.parent.sibling();
            if (getColor(uncle) === 0) {
                if (this.isLeft() && this.parent.isRight()) {
                    this.parent.rotate_right();
                    if (this.right) {
                        this.right._insertRepair();
                    }
                } else if (this.isRight() && this.parent.isLeft()) {
                    this.parent.rotate_left();
                    if (this.left) {
                        this.left._insertRepair();
                    }
                } else if (this.isLeft()) {
                    if (this.grandparent()) {
                        this.grandparent().rotate_right();
                        this.parent.color = 0;
                    }
                    if (this.parent.right) {
                        this.parent.right.color = 1;
                    }
                } else {
                    if (this.grandparent()) {
                        this.grandparent().rotate_left();
                        this.parent.color = 0;
                    }
                    if (this.parent.left) {
                        this.parent.left.color = 1;
                    }
                }
            } else {
                this.parent.color = 0;
                if (uncle && this.grandparent()) {
                    uncle.color = 0;
                    this.grandparent().color = 1;
                    this.grandparent()._insertRepair();
                }
            }
        }
    }

    remove(label) {
        /**Remove label from this tree.*/
        if (this.label === label) {
            if (this.left && this.right) {
                // It's easier to balance a node with at most one child,
                // so we replace this node with the greatest one less than
                // it and remove that.
                let value = this.left.getMax();
                if (value !== null) {
                    this.label = value;
                    this.left.remove(value);
                }
            } else {
                // This node has at most one non-None child, so we don't
                // need to replace
                let child = this.left || this.right;
                if (this.color === 1) {
                    // This node is red, and its child is black
                    // The only way this happens to a node with one child
                    // is if both children are None leaves.
                    // We can just remove this node and call it a day.
                    if (this.parent) {
                        if (this.isLeft()) {
                            this.parent.left = null;
                        } else {
                            this.parent.right = null;
                        }
                    }
                } else {
                    // The node is black
                    if (child === null) {
                        // This node and its child are black
                        if (this.parent === null) {
                            // The tree is now empty
                            return new RedBlackTree(null);
                        } else {
                            this._removeRepair();
                            if (this.isLeft()) {
                                this.parent.left = null;
                            } else {
                                this.parent.right = null;
                            }
                            this.parent = null;
                        }
                    } else {
                        // This node is black and its child is red
                        // Move the child node here and make it black
                        this.label = child.label;
                        this.left = child.left;
                        this.right = child.right;
                        if (this.left) {
                            this.left.parent = this;
                        }
                        if (this.right) {
                            this.right.parent = this;
                        }
                    }
                }
            }
        } else if (this.label !== null && this.label > label) {
            if (this.left) {
                this.left.remove(label);
            }
        } else {
            if (this.right) {
                this.right.remove(label);
            }
        }
        return this.parent || this;
    }

    _removeRepair() {
        if (
            this.parent === null ||
            this.sibling() === null ||
            this.parent.sibling() === null ||
            this.grandparent() === null
        ) {
            return;
        }
        if (getColor(this.sibling()) === 1) {
            this.sibling().color = 0;
            this.parent.color = 1;
            if (this.isLeft()) {
                this.parent.rotateLeft();
            } else {
                this.parent.rotateRight();
            }
        }
        if (
            getColor(this.parent) === 0 &&
            getColor(this.sibling()) === 0 &&
            getColor(this.sibling().left) === 0 &&
            getColor(this.sibling().right) === 0
        ) {
            this.sibling().color = 1;
            this.parent._removeRepair();
            return;
        }
        if (
            getColor(this.parent) === 1 &&
            getColor(this.sibling()) === 0 &&
            getColor(this.sibling().left) === 0 &&
            getColor(this.sibling().right) === 0
        ) {
            this.sibling().color = 1;
            this.parent.color = 0;
            return;
        }
        if (
            this.isLeft() &&
            getColor(this.sibling()) === 0 &&
            getColor(this.sibling().right) === 0 &&
            getColor(this.sibling().left) === 1
        ) {
            this.sibling().rotate_right();
            this.sibling().color = 0;
            if (this.sibling().right) {
                this.sibling().right.color = 1;
            }
        }
        if (
            this.isRight() &&
            getColor(this.sibling()) === 0 &&
            getColor(this.sibling().right) === 1 &&
            getColor(this.sibling().left) === 0
        ) {
            this.sibling().rotateLeft();
            this.sibling().color = 0;
            if (this.sibling().left) {
                this.sibling().left.color = 1;
            }
        }
        if (
            this.isLeft() &&
            getColor(this.sibling()) === 0 &&
            getColor(this.sibling().right) === 1
        ) {
            this.parent.rotate_left();
            this.grandparent().color = this.parent.color;
            this.parent.color = 0;
            this.parent.sibling().color = 0;
        }
        if (
            this.isRight() &&
            getColor(this.sibling()) === 0 &&
            getColor(this.sibling().left) === 1
        ) {
            this.parent.rotate_right();
            this.grandparent().color = this.parent.color;
            this.parent.color = 0;
            this.parent.sibling().color = 0;
        }
    }

    check_color_properties() {
        if (this.color) {
            console.log("Property 2");
            return false;
        }
        if (!this.checkColoring()) {
            console.log("Property 4");
            return false;
        }
        if (this.blackHeight() === null) {
            console.log("Property 5");
            return false;
        }
        return true;
    }

    checkColoring() {
        if (this.color === 1 && [getColor(this.left), getColor(this.right)].includes(1)) {
            return false;
        }
        if (this.left && !this.left.checkColoring()) {
            return false;
        }
        if (this.right && !this.right.checkColoring()) {
            return false;
        }
        return true;
    }

    blackHeight() {
        /**Returns the number of black nodes from this node to the
         * leaves of the tree, or None if there isn't one such value (the
         * tree is color incorrectly).
         */
        if (this === null || this.left === null || this.right === null) {
            // If we're already at a leaf, there is no path
            return 1;
        }
        let left = this.left.blackHeight();
        let right = this.right.blackHeight();
        if (left === null || right === null) {
            // There are issues with coloring below children nodes
            return null;
        }
        if (left !== right) {
            // The two children have unequal depths
            return null;
        }
        // Return the black depth of children, plus one if this node is
        // black
        return left + (1 - this.color);
    }

    // Here are functions which are general to all binary search trees

    contains(label) {
        /**Search through the tree for label, returning True iff it is
         * found somewhere in the tree.
         * Guaranteed to run in O(log(n)) time.
         */
        return this.search(label) !== null;
    }

    search(label) {
        /**Search through the tree for label, returning its node if
         * it's found, and None otherwise.
         * This method is guaranteed to run in O(log(n)) time.
         */
        if (this.label === label) {
            return this;
        } else if (this.label !== null && label > this.label) {
            if (this.right === null) {
                return null;
            } else {
                return this.right.search(label);
            }
        } else {
            if (this.left === null) {
                return null;
            } else {
                return this.left.search(label);
            }
        }
    }

    floor(label) {
        /**Returns the largest element in this tree which is at most label.
         * This method is guaranteed to run in O(log(n)) time.
         */
        if (this.label === label) {
            return this.label;
        } else if (this.label !== null && this.label > label) {
            if (this.left) {
                return this.left.floor(label);
            } else {
                return null;
            }
        } else {
            if (this.right) {
                let attempt = this.right.floor(label);
                if (attempt !== null) {
                    return attempt;
                }
            }
            return this.label;
        }
    }

    ceil(label) {
        /**Returns the smallest element in this tree which is at least label.
         * This method is guaranteed to run in O(log(n)) time.
         */
        if (this.label === label) {
            return this.label;
        } else if (this.label !== null && this.label < label) {
            if (this.right) {
                return this.right.ceil(label);
            } else {
                return null;
            }
        } else {
            if (this.left) {
                let attempt = this.left.ceil(label);
                if (attempt !== null) {
                    return attempt;
                }
            }
            return this.label;
        }
    }

    getMax() {
        /**Returns the largest element in this tree.
         * This method is guaranteed to run in O(log(n)) time.
         */
        if (this.right) {
            // Go as far right as possible
            return this.right.getMax();
        } else {
            return this.label;
        }
    }

    getMin() {
        /**Returns the smallest element in this tree.
         * This method is guaranteed to run in O(log(n)) time.
         */
        if (this.left) {
            // Go as far left as possible
            return this.left.getMin();
        } else {
            return this.label;
        }
    }

    grandparent() {
        if (this.parent === null) {
            return null;
        } else {
            return this.parent.parent;
        }
    }

    sibling() {
        if (this.parent === null) {
            return null;
        } else if (this.parent.left === this) {
            return this.parent.right;
        } else {
            return this.parent.left;
        }
    }

    isLeft() {
        /**Returns true iff this node is the left child of its parent.*/
        if (this.parent === null) {
            return false;
        }
        return this.parent.left === this;
    }

    isRight() {
        /**Returns true iff this node is the right child of its parent.*/
        if (this.parent === null) {
            return false;
        }
        return this.parent.right === this;
    }

    length() {
        console.log("len");
        let ln = 1;
        if (this.left) {
            ln += this.left.length();
        }
        if (this.right) {
            ln += this.right.length();
        }
        return ln;
    }

    *preorder_traverse() {
        yield this.label;
        if (this.left) {
            yield* this.left.preorder_traverse();
        }
        if (this.right) {
            yield* this.right.preorder_traverse();
        }
    }

    *inorder_traverse() {
        if (this.left) {
            yield* this.left.inorder_traverse();
        }
        yield this.label;
        if (this.right) {
            yield* this.right.inorder_traverse();
        }
    }

    *postorder_traverse() {
        if (this.left) {
            yield* this.left.postorder_traverse();
        }
        if (this.right) {
            yield* this.right.postorder_traverse();
        }
        yield this.label;
    }

    equals(other) {
        if (!(other instanceof RedBlackTree)) {
            return false;
        }
        if (this.label === other.label) {
            return ((this.left && this.left.equals && this.left.equals(other.left)) || (!this.left || !this.left.equals && this.left === other.left)) && ((this.right && this.right.equals && this.right.equals(other.right)) || (!this.right || !this.right.equals && this.right === other.right));
        } else {
            return false;
        } 
    }
}

function getColor(node) {
    if (node === null) {
        return 0; // Black
    }
    return node.color;
}
function get_color(node) {
    // Returns the color of a node, allowing for None leaves.
    if (node === null) {
        return 0;
    } else {
        return node.color;
    }
}

// Code for testing the various
// functions of the red-black tree.

function test_rotations() {
    // Make a tree to test on
    let tree = new RedBlackTree(0);
    tree.left = new RedBlackTree(-10, tree);
    tree.right = new RedBlackTree(10, tree);
    tree.left.left = new RedBlackTree(-20, tree.left);
    tree.left.right = new RedBlackTree(-5, tree.left);
    tree.right.left = new RedBlackTree(5, tree.right);
    tree.right.right = new RedBlackTree(20, tree.right);
    // Make the right rotation
    let left_rot = new RedBlackTree(10);
    left_rot.left = new RedBlackTree(0, left_rot);
    left_rot.left.left = new RedBlackTree(-10, left_rot.left);
    left_rot.left.right = new RedBlackTree(5, left_rot.left);
    left_rot.left.left.left = new RedBlackTree(-20, left_rot.left.left);
    left_rot.left.left.right = new RedBlackTree(-5, left_rot.left.left);
    left_rot.right = new RedBlackTree(20, left_rot);
    tree = tree.rotate_left();
    if (!tree.equals(left_rot)) {
        return false;
    }
    tree = tree.rotate_right();
    tree = tree.rotate_right();
    // Make the left rotation
    let right_rot = new RedBlackTree(-10);
    right_rot.left = new RedBlackTree(-20, right_rot);
    right_rot.right = new RedBlackTree(0, right_rot);
    right_rot.right.left = new RedBlackTree(-5, right_rot.right);
    right_rot.right.right = new RedBlackTree(10, right_rot.right);
    right_rot.right.right.left = new RedBlackTree(5, right_rot.right.right);
    right_rot.right.right.right = new RedBlackTree(20, right_rot.right.right);
    if (!tree.equals(right_rot)) {
        return false;
    }
    return true;
}
function test_insertion_speed() {
    /**
     * Test that the tree balances inserts to O(log(n)) by doing a lot
     * of them.
     */
    let tree = new RedBlackTree(-1);
    for (let i = 0; i < 10; i++) {
        tree = tree.insert(i);
    }
    return true;
}
function test_insert() {
    /** Test the insert() method of the tree correctly balances, colors,
    and inserts.
    */
    let tree = new RedBlackTree(0);
    tree.insert(8);
    tree.insert(-8);
    tree.insert(4);
    tree.insert(12);
    tree.insert(10);
    tree.insert(11);
    let ans = new RedBlackTree(0, 0);
    ans.left = new RedBlackTree(-8, 0, ans);
    ans.right = new RedBlackTree(8, 1, ans);
    ans.right.left = new RedBlackTree(4, 0, ans.right);
    ans.right.right = new RedBlackTree(11, 0, ans.right);
    ans.right.right.left = new RedBlackTree(10, 1, ans.right.right);
    ans.right.right.right = new RedBlackTree(12, 1, ans.right.right);
    return tree.equals(ans);
}
function test_insert_and_search() {
    /** Tests searching through the tree for values. */
    let tree = new RedBlackTree(0);
    tree.insert(8);
    tree.insert(-8);
    tree.insert(4);
    tree.insert(12);
    tree.insert(10);
    tree.insert(11);
    if (tree.contains(5) || tree.contains(-6) || tree.contains(-10) || tree.contains(13)) {
        // Found something not in there
        return false;
    }
    if (!(tree.contains(11) && tree.contains(12) && tree.contains(-8) && tree.contains(0))) {
        // Didn't find something in there
        return false;
    }
    return true;
}
function test_insert_delete() {
    /**
    * Test the insert() and delete() method of the tree, verifying the
    * insertion and removal of elements, and the balancing of the tree.
    */
    let tree = new RedBlackTree(0);
    tree = tree.insert(-12);
    tree = tree.insert(8);
    tree = tree.insert(-8);
    tree = tree.insert(15);
    tree = tree.insert(4);
    tree = tree.insert(12);
    tree = tree.insert(10);
    tree = tree.insert(9);
    tree = tree.insert(11);
    tree = tree.remove(15);
    tree = tree.remove(-12);
    tree = tree.remove(9);
    if (!tree.check_color_properties()) {
        return false;
    }
    if (Array.from(tree.inorder_traverse()).toString() !== [-8, 0, 4, 8, 10, 11, 12].toString()) {
        return false;
    }
    return true;
}
function test_floor_ceil() {
    /** Tests the floor and ceiling functions in the tree. */
    tree = new RedBlackTree(0, 0, null, null, null);
    tree.insert(-16);
    tree.insert(16);
    tree.insert(8);
    tree.insert(24);
    tree.insert(20);
    tree.insert(22);
    tuples = [[-20, null, -16], [-10, -16, 0], [8, 8, 8], [50, 24, null]];
    for (var i = 0; i < tuples.length; i++) {
        var val = tuples[i][0];
        var floor = tuples[i][1];
        var ceil = tuples[i][2];
        if (tree.floor(val) !== floor || tree.ceil(val) !== ceil) {
            var _return_value = false;
            return _return_value;
        }
    }
    var _return_value = true;
    return _return_value;
}
function test_min_max() {
    /** Tests the min and max functions in the tree. */
    let tree = new RedBlackTree(0);
    tree.insert(-16);
    tree.insert(16);
    tree.insert(8);
    tree.insert(24);
    tree.insert(20);
    tree.insert(22);
    if (tree.getMax() !== 24 || tree.getMin() !== -16) {
        return false;
    }
    return true;
}
function test_tree_traversal() {
    /** Tests the three different tree traversal functions. */
    let tree = new RedBlackTree(0);
    tree = tree.insert(-16);
    tree.insert(16);
    tree.insert(8);
    tree.insert(24);
    tree.insert(20);
    tree.insert(22);
    if (Array.from(tree.inorder_traverse()).toString() !== [-16, 0, 8, 16, 20, 22, 24].toString()) {
        return false;
    }
    if (Array.from(tree.preorder_traverse()).toString() !== [0, -16, 16, 8, 22, 20, 24].toString()) {
        return false;
    }
    if (Array.from(tree.postorder_traverse()).toString() !== [-16, 8, 20, 24, 22, 16, 0].toString()) {
        return false;
    }
    return true;
}
function test_tree_chaining() {
    tree = new RedBlackTree(0, 0, null, null, null);
    tree.insert(-16)
    tree.insert(16)
    tree.insert(8)
    tree.insert(24)
    tree.insert(20)
    tree.insert(22);
    if (Array.from(tree.inorder_traverse()).toString() !== [-16, 0, 8, 16, 20, 22, 24].toString()) {
        var _return_value = false;
        return _return_value;
    }
    if (Array.from(tree.preorder_traverse()).toString() !== [0, -16, 16, 8, 22, 20, 24].toString()) {
        var _return_value = false;
        return _return_value;
    }
    if (Array.from(tree.postorder_traverse()).toString() !== [-16, 8, 20, 24, 22, 16, 0].toString()) {
        var _return_value = false;
        return _return_value;
    }
    var _return_value = true;
    return _return_value;
}
function print_results(msg, passes) {
    console.log(msg + (passes ? " works!" : " doesn't work :|"));
}
function test() {
    console.log("Rotating right and left", test_rotations());
    console.log("Inserting", test_insert());
    console.log("Searching", test_insert_and_search());
    console.log("Deleting", test_insert_delete());
    console.log("Floor and ceil", test_floor_ceil());
    console.log("Min and max", test_min_max());
    console.log("Tree traversal", test_tree_traversal());
    console.log("Tree traversal", test_tree_chaining());
    console.log("Testing tree balancing...");
    console.log("This should only be a few seconds.");
    test_insertion_speed();
    additional_tests();
    console.log("Done!");
}
function additional_tests() {
    let tree = new RedBlackTree(0);
    console.assert(tree.length() === 1);

    tree = new RedBlackTree(0);
    tree.insert(-16).insert(16).insert(-8).insert(12)
        .insert(-20).insert(8).insert(-4).insert(4)
        .insert(-3).insert(24).insert(-20).insert(20)
        .insert(-1).insert(2).insert(-3).insert(3)
        .insert(10).insert(26);

    tree.right.right.left._removeRepair();
    console.assert(tree.right.right.left.label === 20);
}

// Global Begin
test();