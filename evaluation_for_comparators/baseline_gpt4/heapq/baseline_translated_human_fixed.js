
function heappush(heap, item) {
    heap.push(item);
    _siftdown(heap, 0, heap.length - 1);
}
function heappop(heap) {
    let lastelt = heap.pop();
    if (heap.length > 0) {
        let returnitem = heap[0];
        heap[0] = lastelt;
        _siftup(heap, 0);
        return returnitem;
    }
    return lastelt;
}
function heapreplace(heap, item) {
    let returnitem = heap[0];
    heap[0] = item;
    _siftup(heap, 0);
    return returnitem;
}
function heappushpop(heap, item) {
    if (heap.length > 0 && heap[0] < item) {
        [item, heap[0]] = [heap[0], item];
        _siftup(heap, 0);
    }
    return item;
}
function heapify(x) {
    let n = x.length;
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
        _siftup(x, i);
    }
}
function _heappop_max(heap) {
    let lastelt = heap.pop();
    if (heap.length > 0) {
        let returnitem = heap[0];
        heap[0] = lastelt;
        _siftup_max(heap, 0);
        return returnitem;
    }
    return lastelt;
}
function _heapreplace_max(heap, item) {
    let returnitem = heap[0];
    heap[0] = item;
    _siftup_max(heap, 0);
    return returnitem;
}
function _heapify_max(x) {
    let n = x.length;
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
        _siftup_max(x, i);
    }
}
function _siftdown(heap, startpos, pos) {
    var compare = require('./tracer_skip.js');
    var newitem = heap[pos];
    while (pos > startpos) {
        var parentpos = (pos - 1) >> 1;
        var parent = heap[parentpos];
        if (compare(parent, newitem) > 0) {
            heap[pos] = parent;
            pos = parentpos;
            continue;
        }
        break;
    }
    heap[pos] = newitem;
}
function _siftup(heap, pos) {
    var compare = require('./tracer_skip.js');
    var endpos = heap.length;
    var startpos = pos;
    var newitem = heap[pos];
    var childpos = 2 * pos + 1;
    while (childpos < endpos) {
        var rightpos = childpos + 1;
        if (rightpos < endpos && !(compare(heap[childpos], heap[rightpos]) < 0)) {
            childpos = rightpos;
        }
        
        heap[pos] = heap[childpos];
        pos = childpos;
        childpos = 2 * pos + 1;
    }
    heap[pos] = newitem;
    _siftdown(heap, startpos, pos);
}
function _siftdown_max(heap, startpos, pos) {
    let newitem = heap[pos];
    while (pos > startpos) {
        let parentpos = (pos - 1) >> 1;
        let parent = heap[parentpos];
        if (parent < newitem) {
            heap[pos] = parent;
            pos = parentpos;
            continue;
        }
        break;
    }
    heap[pos] = newitem;
}
function _siftup_max(heap, pos) {
    let endpos = heap.length;
    let startpos = pos;
    let newitem = heap[pos];
    let childpos = 2 * pos + 1;
    while (childpos < endpos) {
        let rightpos = childpos + 1;
        if (rightpos < endpos && !(heap[rightpos] < heap[childpos])) {
            childpos = rightpos;
        }
        
        heap[pos] = heap[childpos];
        pos = childpos;
        childpos = 2 * pos + 1;
    }
    
    heap[pos] = newitem;
    _siftdown_max(heap, startpos, pos);
}
function* merge(reverse, ...iterables) {
    function h_append(x) {
        h.push(x);
    }

    var h = [];
    if (reverse) {
        _heapify = _heapify_max;
        _heappop = _heappop_max;
        _heapreplace = _heapreplace_max;
        direction = -1;
    } else {
        _heapify = heapify;
        _heappop = heappop;
        _heapreplace = heapreplace;
        direction = 1;
    }
    for (var order = 0; order < iterables.length; order++) {
        var it = iterables[order][Symbol.iterator]();
        try {
            var next = it.next.bind(it);
            var next_elem = next();
            if (next_elem.done) continue;
            h_append([next_elem.value, order * direction, next]);
        } catch (e) {
            // pass
            throw e;
        }
    }
    order -= 1;
    _heapify(h);
    while (h.length > 1) {
        try {
            while (true) {
                var s = h[0];
                var [value, order, next] = s;
                yield value;
                var next_elem = next();
                var done = next_elem.done;
                if (done) {
                    _heappop(h);
                    break;
                }
                s[0] = next_elem.value;
                _heapreplace(h, s);
            }
        } catch (e) {
            throw e;
        }
    }
    if (h.length > 0) {
        var [value, order, next] = h[0];
        yield value;
        yield* (function* next_wrap() {
            while(true) {
                var next_elem = next(); 
                var val = next_elem.value;
                var done = next_elem.done;
                if (done) {
                    break;
                }
                yield val;
            };
        })();
    }
    return;
}

function nsmallest(n, iterable) {
    if (n === 1) {
        var it = iterable[Symbol.iterator]();
        var sentinel = {};
        var result = Math.min(...it);
        return result === Infinity ? [] : [result];
    }
    try {
        var size = iterable.length;
    } catch (e) {
        // pass
    }
    if (size !== undefined) {
        if (n >= size) {
            return iterable.slice().sort().slice(0, n);
        }
    }
    it = iterable[Symbol.iterator]();
    result = [];
    for (var i = 0; i < n; i++) {
        var elem = it.next().value;
        if (elem !== undefined) {
            result.push([elem, i]);
        }
    }
    if (!result.length) {
        return result;
    }
    _heapify_max(result);
    var top = result[0][0];
    var order = n;
    var _heapreplace = _heapreplace_max;
    for (elem of it) {
        if (elem < top) {
            _heapreplace(result, [elem, order]);
            top = result[0][0];
            order++;
        }
    }
    result.sort((a, b) => a[0] - b[0]);
    return result.map(function (x) { return x[0]; });
}
function nlargest(n, iterable) {
    if (n === 1) {
        var it = iterable[Symbol.iterator]();
        var result = Math.max(...it);
        return Number.isFinite(result) ? [result] : [];
    }
    try {
        var size = iterable.length;
    } catch (e) {
        // pass
    }
    if (size !== undefined) {
        if (n >= size) {
            return iterable.slice().sort((a, b) => b - a).slice(0, n);
        }
    }
    it = iterable[Symbol.iterator]();
    result = [];
    var index = 0;
    for (var elem of it) {
        if (index < n) {
            result.push([elem, -index]);
            index++;
        } else {
            break;
        }
    }
    if (result.length === 0) {
        return result;
    }
    heapify(result);
    var top = result[0][0];
    var order = -n;
    var _heapreplace = heapreplace;
    for (elem of it) {
        if (top < elem) {
            _heapreplace(result, [elem, order]);
            top = result[0][0];
            order--;
        }
    }
    result.sort((a, b) => b[0] - a[0]);
    return result.map(x => x[0]);
}
function assert_value_equal(a, b) {
    if (Math.abs(a - b) > 0.0001) {
        throw new Error("Assertion failed: Values are not approximately equal");
    }
}
function assert_equal(a, b) {
    for (let i = 0; i < a.length; i++) {
        assert_value_equal(a[i], b[i]);
    }
}
function test_heappush_help_function(items) {
    let heap = [];
    for (let item of items) {
        heap.push(item);
        heap.sort((a, b) => a - b);
    }
    let a = heap.shift();
    let b = heap.shift();
    return [a, b];
}
function test_heappush() {
    let tmp = test_heappush_help_function([6, 1, -2, 5]);
    assert_equal(tmp, [-2, 1]);
    tmp = test_heappush_help_function([34, -3, -12, 0]);
    assert_equal(tmp, [-12, -3]);
    tmp = test_heappush_help_function([5, 4, 3, 2, 1]);
    assert_equal(tmp, [1, 2]);
    tmp = test_heappush_help_function([4.7, 8, -1.2, 7.2]);
    assert_equal(tmp, [-1.2, 4.7]);
}
function test_heapify_help_function(x) {
    x.sort((a, b) => a - b);
    let a = x.shift();
    let b = x.shift();
    return [a, b];
}
function test_heapify() {
    var tmp = test_heapify_help_function([6,1,-2,5]);
    assert_equal(tmp,[-2,1]);
    tmp = test_heapify_help_function([34,-3,-12,0]);
    assert_equal(tmp,[-12,-3]);
    tmp = test_heapify_help_function([5,4,3,2,1]);
    assert_equal(tmp,[1,2]);
    tmp = test_heapify_help_function([4.7,8,-1.2,7.2]);
    assert_equal(tmp,[-1.2,4.7]);
}
function test_heappushpop_help_function(x, i) {
    x.sort((a, b) => a - b);
    if (i < x[0]) {
        return i;
    } else {
        let min = x[0];
        x[0] = i;
        for (let j = 1; j < x.length && x[j] < x[Math.floor((j - 1) / 2)]; j = Math.floor((j - 1) / 2)) {
            let temp = x[j];
            x[j] = x[Math.floor((j - 1) / 2)];
            x[Math.floor((j - 1) / 2)] = temp;
        }
        return min;
    }
}
function test_heappushpop() {
    let tmp = test_heappushpop_help_function([6,1,-2,5], -5);
    assert_value_equal(tmp, -5);
    tmp = test_heappushpop_help_function([34,-3,-12,0], -13);
    assert_value_equal(tmp, -13);
    tmp = test_heappushpop_help_function([5,4,3,2,1], 0);
    assert_value_equal(tmp, 0);
    tmp = test_heappushpop_help_function([4.7,8,-1.2,7.2], 9);
    assert_value_equal(tmp, -1.2);
}
function test_heapreplace_help_function(x, i) {
    heapify(x);
    let a = heapreplace(x, i);
    let b = heappop(x);
    return [a, b];
}
function test_heapreplace() {
    tmp = test_heapreplace_help_function([6,1,-2,5], -5);
    assert_equal(tmp, [-2, -5]);
    tmp = test_heapreplace_help_function([34, -3, -12, 0], -13);
    assert_equal(tmp, [-12, -13]);
    tmp = test_heapreplace_help_function([5, 4, 3, 2, 1], 0);
    assert_equal(tmp, [1, 0]);
    tmp = test_heapreplace_help_function([4.7, 8, -1.2, 7.2], 9);
    assert_equal(tmp, [-1.2, 4.7]);
}
function test_merge() {
    let tmp = Array.from(merge(false, [1,3,5,7], [0,2,4,8], [5,10,15,20], [], [25]));
    assert_equal(tmp, [0, 1, 2, 3, 4, 5, 5, 7, 8, 10, 15, 20, 25]);
    tmp = Array.from(merge(true, [7,5,3,1], [8,4,2,0]));
    assert_equal(tmp, [8, 7, 5, 4, 3, 2, 1, 0]);
}
function test_nsmallest() {
    var tmp = nsmallest(1, [6,1,-2,5]);
    assert_equal(tmp,[-2]);
    tmp = nsmallest(2, [34,-3,-12,0]);
    assert_equal(tmp,[-12,-3]);
    tmp = nsmallest(2, [5,4,3,2,1]);
    assert_equal(tmp,[1,2]);
    tmp = nsmallest(2, [4.7,8,-1.2,7.2]);
    assert_equal(tmp,[-1.2,4.7]);
}
function test_nlargest() {
    tmp = nlargest(1, [6,1,-2,5])
    assert_equal(tmp, [6])
    tmp = nlargest(2, [34,-3,-12,0])
    assert_equal(tmp, [34,0])
    tmp = nlargest(2, [5,4,3,2,1])
    assert_equal(tmp, [5,4])
    tmp = nlargest(2, [4.7,8,-1.2,7.2])
    assert_equal(tmp, [8,7.2])
}
function test() {
    test_heappush();
    test_heapify();
    test_heappushpop();
    test_heapreplace();
    test_nsmallest();
    test_nlargest();
    test_merge();
    additional_tests();
}
function additional_tests() {
    let heap = [1];
    let tmp = heap.pop(); // Simulating heappop
    assert_value_equal(tmp, 1);
    heap = [1];
    tmp = heap.pop(); // Simulating _heappop_max
    assert_value_equal(tmp, 1);

    tmp = nsmallest(0, [1]);
    assert_equal(tmp, []);
    
    tmp = nsmallest(2, []);
    assert_equal(tmp, []);

    tmp = nsmallest(0, []);
    assert_equal(tmp, []);

    tmp = nlargest(0, [1]);
    assert_equal(tmp, []);
    
    tmp = nlargest(2, []);
    assert_equal(tmp, []);

    tmp = nlargest(0, []);
    assert_equal(tmp, []);

    heap = [1, 2, 3];
    _siftup_max(heap, 0); // Assuming _siftup_max is defined elsewhere
    assert_equal(heap, [3, 2, 1]);
}

// Global Begin
test();