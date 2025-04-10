
class Node {
    constructor(label, parent = null) {
        this.label = label;
        this.parent = parent;
        this.left = null;
        this.right = null;
    }
}
class BinarySearchTree {
    constructor() {
        this.root = null;
    }

    empty() {
        this.root = null;
    }

    is_empty() {
        return this.root === null;
    }

    put(label) {
        this.root = this._put(this.root, label, null);
    }

    _put(node, label, parent) {
        if (node === null) {
            node = new Node(label, parent);
        } else {
            if (label < node.label) {
                node.left = this._put(node.left, label, node);
            } else if (label > node.label) {
                node.right = this._put(node.right, label, node);
            } else {
                let msg = `Node with label ${label} already exists`;
                throw new Error(msg);
            }
        }
        return node;
    }

    search(label) {
        return this._search(this.root, label);
    }

    _search(node, label) {
        if (node === null) {
            let msg = `Node with label ${label} does not exist`;
            throw new Error(msg);
        } else {
            if (label < node.label) {
                node = this._search(node.left, label);
            } else if (label > node.label) {
                node = this._search(node.right, label);
            }
        }
        return node;
    }

    remove(label) {
        let node = this.search(label);
        if (node.right && node.left) {
            let lowest_node = this._get_lowest_node(node.right);
            lowest_node.left = node.left;
            lowest_node.right = node.right;
            node.left.parent = lowest_node;
            if (node.right) {
                node.right.parent = lowest_node;
            }
            this._reassign_nodes(node, lowest_node);
        } else if (!node.right && node.left) {
            this._reassign_nodes(node, node.left);
        } else if (node.right && !node.left) {
            this._reassign_nodes(node, node.right);
        } else {
            this._reassign_nodes(node, null);
        }
    }

    _reassign_nodes(node, new_children) {
        if (new_children) {
            new_children.parent = node.parent;
        }

        if (node.parent) {
            if (node.parent.right === node) {
                node.parent.right = new_children;
            } else {
                node.parent.left = new_children;
            }
        } else {
            this.root = new_children;
        }
    }

    _get_lowest_node(node) {
        var lowest_node;
        if (node.left) {
            lowest_node = this._get_lowest_node(node.left);
        } else {
            lowest_node = node;
            this._reassign_nodes(node, node.right);
        }
        return lowest_node;    
    }

    exists(label) {
        try {
            this.search(label);
            return true;
        } catch (exception) {
            return false;
        }
    }

    get_max_label() {
        if (this.root === null) {
            throw new Error("Binary search tree is empty");
        }

        let node = this.root;
        while (node.right !== null) {
            node = node.right;
        }

        return node.label;
    }

    get_min_label() {
        if (this.root === null) {
            throw new Error("Binary search tree is empty");
        }

        let node = this.root;
        while (node.left !== null) {
            node = node.left;
        }

        return node.label;
    }

    *inorder_traversal() {
        function* helper(node) {
            if (node !== null) {
                yield* helper(node.left);
                yield node;
                yield* helper(node.right);
            }
        }
        yield* helper(this.root);
    }

    *preorder_traversal() {
        function* helper(node) {
            if (node !== null) {
                yield node;
                yield* helper(node.left);
                yield* helper(node.right);
            }
        }
        yield* helper(this.root);
    }
}
function _get_binary_search_tree() {
    /*
            8
            / \
        3   10
        / \    \
        1   6    14
            / \   /
        4   7 13
            \
            5
    */
    let t = new BinarySearchTree();
    t.put(8);
    t.put(3);
    t.put(6);
    t.put(1);
    t.put(10);
    t.put(14);
    t.put(13);
    t.put(4);
    t.put(7);
    t.put(5);

    return t;
}
function test_put() {
    let t = new BinarySearchTree();
    console.assert(t.is_empty());

    t.put(8);
    /*
            8
    */
    console.assert(t.root !== null);
    console.assert(t.root.parent === null);
    console.assert(t.root.label === 8);

    t.put(10);
    /*
            8
             \
             10
    */
    console.assert(t.root.right !== null);
    console.assert(t.root.right.parent === t.root);
    console.assert(t.root.right.label === 10);

    t.put(3);
    /*
            8
           / \
          3   10
    */
    console.assert(t.root.left !== null);
    console.assert(t.root.left.parent === t.root);
    console.assert(t.root.left.label === 3);

    t.put(6);
    /*
            8
           / \
          3   10
             \
              6
    */
    console.assert(t.root.left.right !== null);
    console.assert(t.root.left.right.parent === t.root.left);
    console.assert(t.root.left.right.label === 6);

    t.put(1);
    /*
            8
           / \
          3   10
         / \
        1   6
    */
    console.assert(t.root.left.left !== null);
    console.assert(t.root.left.left.parent === t.root.left);
    console.assert(t.root.left.left.label === 1);

    try {
        t.put(1);
    } catch (exception) {
        // Exception handled
    }
}
function test_search() {
    let t = _get_binary_search_tree();

    let node = t.search(6);
    console.assert(node.label === 6, "Test failed: node.label is not 6");

    node = t.search(13);
    console.assert(node.label === 13, "Test failed: node.label is not 13");

    try {
        t.search(2);
    } catch (exception) {
        // pass
    }
}
function test_remove() {
    let t = _get_binary_search_tree();

    t.remove(13);
    /*
            8
            / \
        3   10
        / \    \
        1   6    14
            / \
        4   7
            \
            5
    */
    console.assert(t.root !== null);
    console.assert(t.root.right !== null);
    console.assert(t.root.right.right !== null);
    console.assert(t.root.right.right.right === null);
    console.assert(t.root.right.right.left === null);

    t.remove(7);
    /*
            8
            / \
        3   10
        / \    \
        1   6    14
            /
        4
            \
            5
    */
    console.assert(t.root.left !== null);
    console.assert(t.root.left.right !== null);
    console.assert(t.root.left.right.left !== null);
    console.assert(t.root.left.right.right === null);
    console.assert(t.root.left.right.left.label === 4);

    t.remove(6);
    /*
            8
            / \
        3   10
        / \    \
        1   4    14
            \
            5
    */
    console.assert(t.root.left.left !== null);
    console.assert(t.root.left.right.right !== null);
    console.assert(t.root.left.left.label === 1);
    console.assert(t.root.left.right.label === 4);
    console.assert(t.root.left.right.right.label === 5);
    console.assert(t.root.left.right.left === null);
    console.assert(t.root.left.left.parent === t.root.left);
    console.assert(t.root.left.right.parent === t.root.left);

    t.remove(3);
    /*
            8
            / \
        4   10
        / \    \
        1   5    14
    */
    console.assert(t.root !== null);
    console.assert(t.root.left.label === 4);
    console.assert(t.root.left.right.label === 5);
    console.assert(t.root.left.left.label === 1);
    console.assert(t.root.left.parent === t.root);
    console.assert(t.root.left.left.parent === t.root.left);
    console.assert(t.root.left.right.parent === t.root.left);

    t.remove(4);
    /*
            8
            / \
        5   10
        /      \
        1        14
    */
    console.assert(t.root.left !== null);
    console.assert(t.root.left.left !== null);
    console.assert(t.root.left.label === 5);
    console.assert(t.root.left.right === null);
    console.assert(t.root.left.left.label === 1);
    console.assert(t.root.left.parent === t.root);
    console.assert(t.root.left.left.parent === t.root.left);
}
function test_remove_2() {

    let t = _get_binary_search_tree();

    t.remove(3);
    /*
            8
            / \
        4   10
        / \    \
        1   6    14
            / \   /
        5   7 13
    */
    console.assert(t.root !== null);
    console.assert(t.root.left !== null);
    console.assert(t.root.left.left !== null);
    console.assert(t.root.left.right !== null);
    console.assert(t.root.left.right.left !== null);
    console.assert(t.root.left.right.right !== null);
    console.assert(t.root.left.label === 4);
    console.assert(t.root.left.right.label === 6);
    console.assert(t.root.left.left.label === 1);
    console.assert(t.root.left.right.right.label === 7);
    console.assert(t.root.left.right.left.label === 5);
    console.assert(t.root.left.parent === t.root);
    console.assert(t.root.left.right.parent === t.root.left);
    console.assert(t.root.left.left.parent === t.root.left);
    console.assert(t.root.left.right.left.parent === t.root.left.right);
}
function test_empty() {
    let t = _get_binary_search_tree();
    t.empty();
    console.assert(t.root === null);
}
function test_is_empty() {
    let t = _get_binary_search_tree();
    console.assert(!t.is_empty());

    t.empty();
    console.assert(t.is_empty());
}
function test_exists() {
    let t = _get_binary_search_tree();

    console.assert(t.exists(6));
    console.assert(!t.exists(-1));
}
function test_get_max_label() {
    let t = _get_binary_search_tree();

    if (t.get_max_label() !== 14) {
        throw new Error("Assertion failed");
    }

    t.empty();

    try {
        t.get_max_label();
    } catch (exception) {
        // pass
    }
}
function test_get_min_label() {
    let t = _get_binary_search_tree();

    if (t.get_min_label() !== 1) {
        throw new Error("Assertion failed");
    }

    t.empty();

    try {
        t.get_min_label();
    } catch (exception) {
        // pass
    }
}
function test_inorder_traversal() {
    let t = _get_binary_search_tree();

    let inorder_traversal_nodes = Array.from(t.inorder_traversal(), i => i.label);
    console.assert(JSON.stringify(inorder_traversal_nodes) === JSON.stringify([1, 3, 4, 5, 6, 7, 8, 10, 13, 14]));
}
function test_preorder_traversal() {
    let t = _get_binary_search_tree();

    let preorder_traversal_nodes = Array.from(t.preorder_traversal(), i => i.label);
    console.assert(JSON.stringify(preorder_traversal_nodes) === JSON.stringify([8, 3, 1, 6, 4, 5, 7, 10, 14, 13]));
}
function binary_search_tree_example() {
    /*
    Example
                  8
                 / \
                3   10
               / \    \
              1   6    14
                 / \   /
                4   7 13
                \
                5

    Example After Deletion
                  4
                 / \
                1   7
                     \
                      5

    */

    let t = new BinarySearchTree();
    t.put(8);
    t.put(3);
    t.put(6);
    t.put(1);
    t.put(10);
    t.put(14);
    t.put(13);
    t.put(4);
    t.put(7);
    t.put(5);

    console.log(
        `
            8
           / \\
          3   10
         / \\    \\
        1   6    14
           / \\   /
          4   7 13
           \\
            5
        `
    );

    console.log("Label 6 exists:", t.exists(6));
    console.log("Label 13 exists:", t.exists(13));
    console.log("Label -1 exists:", t.exists(-1));
    console.log("Label 12 exists:", t.exists(12));

    // Prints all the elements of the list in inorder traversal
    tmp = t.inorder_traversal()
    var inorder_traversal_nodes = Array.from(tmp).map(function(i) { return i.label; });
    console.log("Inorder traversal:", inorder_traversal_nodes);

    // Prints all the elements of the list in preorder traversal
    tmp = t.preorder_traversal()
    var preorder_traversal_nodes = Array.from(tmp).map(function(i) { return i.label; });
    console.log("Preorder traversal:", preorder_traversal_nodes);

    console.log("Max. label:", t.get_max_label());
    console.log("Min. label:", t.get_min_label());

    // Delete elements
    console.log("\nDeleting elements 13, 10, 8, 3, 6, 14");
    console.log(
        `
          4
         / \\
        1   7
             \\
              5
        `
    );
    t.remove(13);
    t.remove(10);
    t.remove(8);
    t.remove(3);
    t.remove(6);
    t.remove(14);

    // Prints all the elements of the list in inorder traversal
    tmp = t.inorder_traversal()
    inorder_traversal_nodes = Array.from(tmp).map(function(i) { return i.label; });
    console.log("Inorder traversal:", inorder_traversal_nodes);

    // Prints all the elements of the list in preorder traversal
    tmp = t.preorder_traversal()
    preorder_traversal_nodes = Array.from(tmp).map(function(i) { return i.label; });
    console.log("Preorder traversal:", preorder_traversal_nodes);

    console.log("Max. label:", t.get_max_label());
    console.log("Min. label:", t.get_min_label());
}
function test() {
    binary_search_tree_example();
    test_put();
    test_search();
    test_remove();
    test_remove_2();
    test_is_empty();
    test_empty();
    test_exists();
    test_get_max_label();
    test_get_min_label();
    test_inorder_traversal();
    test_preorder_traversal();
}

// Global Begin
test();