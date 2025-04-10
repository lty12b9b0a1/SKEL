// JavaScript does not have direct equivalents for Python imports that are not part of the standard library or are specific to Python.
// You might need to find or implement equivalent functionality in JavaScript or use existing libraries that provide similar features.
var {input_shanghai, input_shanghai_city} = require('./tracer_skip.js')


class StringDistance {

    distance(s0, s1) {
        return null;
    }

}
class NormalizedStringDistance extends StringDistance {

    distance(s0, s1) {
        return null;
    }

}
class MetricStringDistance extends StringDistance {

    distance(s0, s1) {
        return null;
    }

}
class Levenshtein extends MetricStringDistance {

    distance(s0, s1) {
        if (s0 === null) {
            throw new TypeError("Argument s0 is NoneType.");
        }
        if (s1 === null) {
            throw new TypeError("Argument s1 is NoneType.");
        }
        if (s0 === s1) {
            return 0.0;
        }
        if (s0.length === 0) {
            return s1.length;
        }
        if (s1.length === 0) {
            return s0.length;
        }

        let v0 = new Array(s1.length + 1);
        let v1 = new Array(s1.length + 1);

        for (let i = 0; i < v0.length; i++) {
            v0[i] = i;
        }

        for (let i = 0; i < s0.length; i++) {
            v1[0] = i + 1;
            for (let j = 0; j < s1.length; j++) {
                let cost = 1;
                if (s0[i] === s1[j]) {
                    cost = 0;
                }
                v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
            }
            [v0, v1] = [v1, v0];
        }

        return v0[s1.length];
    }
}
class LongestCommonSubsequence extends StringDistance {
    distance(s0, s1) {
        if (s0 === null) {
            throw new TypeError("Argument s0 is NoneType.");
        }
        if (s1 === null) {
            throw new TypeError("Argument s1 is NoneType.");
        }
        if (s0 === s1) {
            return 0.0;
        }
        return s0.length + s1.length - 2 * this.length(s0, s1);
    }

    length(s0, s1) {
        if (s0 === null) {
            throw new TypeError("Argument s0 is NoneType.");
        }
        if (s1 === null) {
            throw new TypeError("Argument s1 is NoneType.");
        }
        let s0_len = s0.length, s1_len = s1.length;
        let x = s0.slice(), y = s1.slice();
        let matrix = Array.from({ length: s0_len + 1 }, () => new Array(s1_len + 1).fill(0));
        for (let i = 1; i <= s0_len; i++) {
            for (let j = 1; j <= s1_len; j++) {
                if (x[i - 1] === y[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1] + 1;
                } else {
                    matrix[i][j] = Math.max(matrix[i][j - 1], matrix[i - 1][j]);
                }
            }
        }
        return matrix[s0_len][s1_len];
    }
}
class MetricLCS extends MetricStringDistance {
    constructor() {
        super();
        this.lcs = new LongestCommonSubsequence();
    }

    distance(s0, s1) {
        if (s0 === null) {
            throw new TypeError("Argument s0 is NoneType.");
        }
        if (s1 === null) {
            throw new TypeError("Argument s1 is NoneType.");
        }
        if (s0 === s1) {
            return 0.0;
        }
        let max_len = Math.max(s0.length, s1.length);
        if (max_len === 0) {
            return 0.0;
        }
        return 1.0 - (1.0 * this.lcs.length(s0, s1) / max_len);
    }
}
class NGram {

    constructor(n = 2) {
        this.n = n;
    }

    distance(s0, s1) {
        if (s0 === null) {
            throw new TypeError("Argument s0 is NoneType.");
        }
        if (s1 === null) {
            throw new TypeError("Argument s1 is NoneType.");
        }
        if (s0 === s1) {
            return 0.0;
        }

        const special = '\n';
        const sl = s0.length;
        const tl = s1.length;

        if (sl === 0 || tl === 0) {
            return 1.0;
        }

        let cost = 0;
        if (sl < this.n || tl < this.n) {
            for (let i = 0; i < Math.min(sl, tl); i++) {
                if (s0[i] === s1[i]) {
                    cost += 1;
                }
            }
            return 1.0 - cost / Math.max(sl, tl);
        }

        let sa = Array(sl + this.n - 1).fill('');

        for (let i = 0; i < sa.length; i++) {
            if (i < this.n - 1) {
                sa[i] = special;
            } else {
                sa[i] = s0[i - this.n + 1];
            }
        }

        let p = Array(sl + 1).fill(0.0);
        let d = Array(sl + 1).fill(0.0);
        let t_j = Array(this.n).fill('');

        for (let i = 0; i <= sl; i++) {
            p[i] = 1.0 * i;
        }

        for (let j = 1; j <= tl; j++) {
            if (j < this.n) {
                for (let ti = 0; ti < this.n - j; ti++) {
                    t_j[ti] = special;
                }
                for (let ti = this.n - j; ti < this.n; ti++) {
                    t_j[ti] = s1[ti - (this.n - j)];
                }
            } else {
                t_j = s1.slice(j - this.n, j);
            }

            d[0] = 1.0 * j;
            for (let i = 1; i <= sl; i++) {
                cost = 0;
                let tn = this.n;
                for (let ni = 0; ni < this.n; ni++) {
                    if (sa[i - 1 + ni] !== t_j[ni]) {
                        cost += 1;
                    } else if (sa[i - 1 + ni] === special) {
                        tn -= 1;
                    }
                }
                let ec = cost / tn;
                d[i] = Math.min(d[i - 1] + 1, p[i] + 1, p[i - 1] + ec);
            }
            [p, d] = [d, p];
        }

        return p[sl] / Math.max(tl, sl);
    }
}
class Damerau {

    distance(s0, s1) {
        if (s0 === null) {
            throw new TypeError("Argument s0 is NoneType.");
        }
        if (s1 === null) {
            throw new TypeError("Argument s1 is NoneType.");
        }
        if (s0 === s1) {
            return 0.0;
        }
        let inf = s0.length + s1.length;
        let da = {};
        for (let i = 0; i < s0.length; i++) {
            da[s0[i]] = '0';
        }
        for (let i = 0; i < s1.length; i++) {
            da[s1[i]] = '0';
        }
        let h = [];
        for (let i = 0; i < s0.length + 2; i++) {
            h.push(new Array(s1.length + 2).fill(0));
        }
        for (let i = 0; i < s0.length + 1; i++) {
            h[i + 1][0] = inf;
            h[i + 1][1] = i;
        }
        for (let j = 0; j < s1.length + 1; j++) {
            h[0][j + 1] = inf;
            h[1][j + 1] = j;
        }
        for (let i = 1; i < s0.length + 1; i++) {
            let db = 0;
            for (let j = 1; j < s1.length + 1; j++) {
                let i1 = parseInt(da[s1[j - 1]]);
                let j1 = db;

                let cost = 1;
                if (s0[i - 1] === s1[j - 1]) {
                    cost = 0;
                    db = j;
                }
                h[i + 1][j + 1] = Math.min(h[i][j] + cost,
                                           h[i + 1][j] + 1,
                                           h[i][j + 1] + 1,
                                           h[i1][j1] + (i - i1 - 1) + 1 + (j - j1 - 1));
            }
            da[s0[i - 1]] = String(i);
        }

        return h[s0.length + 1][s1.length + 1];
    }

}
class ShingleBased {
    constructor(k = 3) {
        this.k = k;
    }

    get_k() {
        return this.k;
    }

    get_profile(string) {
        let shingles = {};
        let no_space_str = string.replace(/\s+/g, " ");
        for (let i = 0; i <= no_space_str.length - this.k; i++) {
            let shingle = no_space_str.substring(i, i + this.k);
            let old = shingles[shingle];
            if (old) {
                shingles[shingle] = old + 1;
            } else {
                shingles[shingle] = 1;
            }
        }
        return shingles;
    }
}
class StringSimilarity {

    similarity(s0, s1) {
        return null;
    }

}
class NormalizedStringSimilarity extends StringSimilarity {
    similarity(s0, s1) {
        return null;
    }
}
class Cosine extends ShingleBased {

    constructor(k) {
        super(k);
    }

    distance(s0, s1) {
        return 1.0 - this.similarity(s0, s1);
    }

    similarity(s0, s1) {
        if (s0 === null) {
            throw new TypeError("Argument s0 is NoneType.");
        }
        if (s1 === null) {
            throw new TypeError("Argument s1 is NoneType.");
        }
        if (s0 === s1) {
            return 1.0;
        }
        if (s0.length < this.get_k() || s1.length < this.get_k()) {
            return 0.0;
        }
        let profile0 = this.get_profile(s0);
        let profile1 = this.get_profile(s1);
        return this._dot_product(profile0, profile1) / (this._norm(profile0) * this._norm(profile1));
    }

    similarity_profiles(profile0, profile1) {
        return this._dot_product(profile0, profile1) / (this._norm(profile0) * this._norm(profile1));
    }

    _dot_product(profile0, profile1) {
        let small = profile1;
        let large = profile0;
        if (Object.keys(profile0).length < Object.keys(profile1).length) {
            small = profile0;
            large = profile1;
        }
        let agg = 0.0;
        for (let k in small) {
            if (small.hasOwnProperty(k)) {
                let i = large[k];
                if (!i) {
                    continue;
                }
                agg += 1.0 * small[k] * i;
            }
        }
        return agg;
    }

    _norm(profile) {
        let agg = 0.0;
        for (let k in profile) {
            if (profile.hasOwnProperty(k)) {
                agg += 1.0 * profile[k] * profile[k];
            }
        }
        return Math.sqrt(agg);
    }
}
class Jaccard extends ShingleBased {

    constructor(k) {
        super(k);
    }

    distance(s0, s1) {
        return 1.0 - this.similarity(s0, s1);
    }

    similarity(s0, s1) {
        if (s0 === null) {
            throw new TypeError("Argument s0 is NoneType.");
        }
        if (s1 === null) {
            throw new TypeError("Argument s1 is NoneType.");
        }
        if (s0 === s1) {
            return 1.0;
        }
        if (s0.length < this.get_k() || s1.length < this.get_k()) {
            return 0.0;
        }
        let profile0 = this.get_profile(s0);
        let profile1 = this.get_profile(s1);
        let union = new Set();
        for (let ite in profile0) {
            union.add(ite);
        }
        for (let ite in profile1) {
            union.add(ite);
        }
        let inter = parseInt(Object.keys(profile0).length + Object.keys(profile1).length - union.size);
        return 1.0 * inter / union.size;
    }
}
class JaroWinkler {

    constructor(threshold = 0.7) {
        this.threshold = threshold;
        this.three = 3;
        this.jw_coef = 0.1;
    }

    get_threshold() {
        return this.threshold;
    }

    similarity(s0, s1) {
        if (s0 === null) {
            throw new TypeError("Argument s0 is NoneType.");
        }
        if (s1 === null) {
            throw new TypeError("Argument s1 is NoneType.");
        }
        if (s0 === s1) {
            return 1.0;
        }
        let mtp = this.matches(s0, s1);
        let m = mtp[0];
        if (m === 0) {
            return 0.0;
        }
        let j = (m / s0.length + m / s1.length + (m - mtp[1]) / m) / this.three;
        let jw = j;
        if (j > this.get_threshold()) {
            jw = j + Math.min(this.jw_coef, 1.0 / mtp[this.three]) * mtp[2] * (1 - j);
        }
        return jw;
    }

    distance(s0, s1) {
        return 1.0 - this.similarity(s0, s1);
    }

    matches(s0, s1) {
        let max_str, min_str;
        if (s0.length > s1.length) {
            max_str = s0;
            min_str = s1;
        } else {
            max_str = s1;
            min_str = s0;
        }
        let ran = Math.max(Math.floor(max_str.length / 2 - 1), 0);
        let match_indexes = Array(min_str.length).fill(-1);
        let match_flags = Array(max_str.length).fill(false);
        let matches = 0;
        for (let mi = 0; mi < min_str.length; mi++) {
            let c1 = min_str[mi];
            for (let xi = Math.max(mi - ran, 0); xi < Math.min(mi + ran + 1, max_str.length); xi++) {
                if (!match_flags[xi] && c1 === max_str[xi]) {
                    match_indexes[mi] = xi;
                    match_flags[xi] = true;
                    matches++;
                    break;
                }
            }
        }

        let ms0 = Array(matches).fill(0);
        let ms1 = Array(matches).fill(0);
        let si = 0;
        for (let i = 0; i < min_str.length; i++) {
            if (match_indexes[i] !== -1) {
                ms0[si] = min_str[i];
                si++;
            }
        }
        si = 0;
        for (let j = 0; j < max_str.length; j++) {
            if (match_flags[j]) {
                ms1[si] = max_str[j];
                si++;
            }
        }
        let transpositions = 0;
        for (let mi = 0; mi < ms0.length; mi++) {
            if (ms0[mi] !== ms1[mi]) {
                transpositions++;
            }
        }
        let prefix = 0;
        for (let mi = 0; mi < min_str.length; mi++) {
            if (s0[mi] === s1[mi]) {
                prefix++;
            } else {
                break;
            }
        }
        return [matches, Math.floor(transpositions / 2), prefix, max_str.length];
    }
}
class NormalizedLevenshtein extends NormalizedStringDistance {

    constructor() {
        super();
        this.levenshtein = new Levenshtein();
    }

    distance(s0, s1) {
        if (s0 === null) {
            throw new TypeError("Argument s0 is NoneType.");
        }
        if (s1 === null) {
            throw new TypeError("Argument s1 is NoneType.");
        }
        if (s0 === s1) {
            return 0.0;
        }
        let m_len = Math.max(s0.length, s1.length);
        if (m_len === 0) {
            return 0.0;
        }
        return this.levenshtein.distance(s0, s1) / m_len;
    }

    similarity(s0, s1) {
        return 1.0 - this.distance(s0, s1);
    }

}
class OptimalStringAlignment extends StringDistance {

    distance(s0, s1) {
        if (s0 === null) {
            throw new TypeError("Argument s0 is NoneType.");
        }
        if (s1 === null) {
            throw new TypeError("Argument s1 is NoneType.");
        }
        if (s0 === s1) {
            return 0.0;
        }

        let n = s0.length, m = s1.length;
        if (n === 0) {
            return 1.0 * n;
        }
        if (m === 0) {
            return 1.0 * m;
        }

        let d = Array.from({ length: n + 2 }, () => Array(m + 2).fill(0));
        for (let i = 0; i <= n; i++) {
            d[i][0] = i;
        }
        for (let j = 0; j <= m; j++) {
            d[0][j] = j;
        }

        for (let i = 1; i <= n; i++) {
            for (let j = 1; j <= m; j++) {
                let cost = 1;
                if (s0[i - 1] === s1[j - 1]) {
                    cost = 0;
                }
                d[i][j] = Math.min(d[i - 1][j - 1] + cost, d[i][j - 1] + 1, d[i - 1][j] + 1);

                if (i > 1 && j > 1 && s0[i - 1] === s1[j - 2] && s0[i - 2] === s1[j - 1]) {
                    d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
                }
            }
        }

        return d[n][m];
    }
}
class OverlapCoefficient extends ShingleBased {

    constructor(k = 3) {
        super(k);
    }

    distance(s0, s1) {
        return 1.0 - this.similarity(s0, s1);
    }

    similarity(s0, s1) {
        if (s0 === null) {
            throw new TypeError("Argument s0 is NoneType.");
        }
        if (s1 === null) {
            throw new TypeError("Argument s1 is NoneType.");
        }
        if (s0 === s1) {
            return 1.0;
        }
        let union = new Set();
        let profile0 = this.get_profile(s0), profile1 = this.get_profile(s1);
        for (let k in profile0) {
            union.add(k);
        }
        for (let k in profile1) {
            union.add(k);
        }
        let inter = parseInt(Object.keys(profile0).length + Object.keys(profile1).length - union.size);
        return inter / Math.min(Object.keys(profile0).length, Object.keys(profile1).length);
    }
}
class QGram extends ShingleBased {
    constructor(k = 3) {
        super(k);
    }

    distance(s0, s1) {
        if (s0 === null) {
            throw new TypeError("Argument s0 is NoneType.");
        }
        if (s1 === null) {
            throw new TypeError("Argument s1 is NoneType.");
        }
        if (s0 === s1) {
            return 0.0;
        }

        let profile0 = this.get_profile(s0);
        let profile1 = this.get_profile(s1);
        return this.constructor.distance_profile(profile0, profile1);
    }

    static distance_profile(profile0, profile1) {
        let union = new Set();
        for (let k in profile0) {
            union.add(k);
        }
        for (let k in profile1) {
            union.add(k);
        }
        let agg = 0;
        for (let k of union) {
            let v0 = 0, v1 = 0;
            if (profile0.hasOwnProperty(k)) {
                v0 = parseInt(profile0[k]);
            }
            if (profile1.hasOwnProperty(k)) {
                v1 = parseInt(profile1[k]);
            }
            agg += Math.abs(v0 - v1);
        }
        return agg;
    }
}
class SIFT4Options {
    constructor(options = null) {
        const _code0 = (x) => [...x];
        const _code1 = (t1, t2) => t1 === t2;
        const _code2 = (t1, t2) => 1;
        const _code3 = (x) => x;
        const _code4 = (c1, c2) => 1;
        const _code5 = (lcss, trans) => lcss - trans;

        this.options = {
            'maxdistance': 0,
            'tokenizer': _code0,
            'tokenmatcher': _code1,
            'matchingevaluator': _code2,
            'locallengthevaluator': _code3,
            'transpositioncostevaluator': _code4,
            'transpositionsevaluator': _code5
        };

        const otheroptions = {
            'tokenizer': {'ngram': this.ngramtokenizer, 'wordsplit': this.wordsplittokenizer, 'characterfrequency': this.characterfrequencytokenizer},
            'tokematcher': {'sift4tokenmatcher': this.sift4tokenmatcher},
            'matchingevaluator': {'sift4matchingevaluator': this.sift4matchingevaluator},
            'locallengthevaluator': {'rewardlengthevaluator': this.rewardlengthevaluator, 'rewardlengthevaluator2': this.rewardlengthevaluator2},
            'transpositioncostevaluator': {'longertranspositionsaremorecostly': this.longertranspositionsaremorecostly},
            'transpositionsevaluator': {}
        };

        if (typeof options === 'object' && options !== null) {
            for (const [k, v] of Object.entries(options)) {
                if (k in this.options) {
                    if (k === 'maxdistance') {
                        if (typeof v === 'number') {
                            this.options[k] = v;
                        } else {
                            throw new Error("Option maxdistance should be int");
                        }
                    } else {
                        if (typeof v === 'function') {
                            this.options[k] = v;
                        } else {
                            if (v in otheroptions[k]) {
                                this.options[k] = otheroptions[k][v];
                            } else {
                                const msg = `Option ${k} should be callable or one of [${Object.keys(otheroptions[k]).join(', ')}]`;
                                throw new Error(msg);
                            }
                        }
                    }
                } else {
                    throw new Error(`Option ${k} not recognized.`);
                }
            }
        } else if (options !== null) {
            throw new Error("options should be a dictionary");
        }

        this.maxdistance = this.options['maxdistance'];
        this.tokenizer = this.options['tokenizer'];
        this.tokenmatcher = this.options['tokenmatcher'];
        this.matchingevaluator = this.options['matchingevaluator'];
        this.locallengthevaluator = this.options['locallengthevaluator'];
        this.transpositioncostevaluator = this.options['transpositioncostevaluator'];
        this.transpositionsevaluator = this.options['transpositionsevaluator'];
    }

    // tokenizers:
    static ngramtokenizer(s, n) {
        const result = [];
        if (!s) return result;
        for (let i = 0; i < s.length - n + 1; i++) {
            result.push(s.substring(i, i + n));
        }
        return result;
    }

    static wordsplittokenizer(s) {
        if (!s) return [];
        return s.split(' ');
    }

    static characterfrequencytokenizer(s) {
        const letters = [...'abcdefghijklmnopqrstuvwxyz'];
        return letters.map(x => s.toLowerCase().split(x).length - 1);
    }

    // tokenMatchers:
    static sift4tokenmatcher(t1, t2) {
        const similarity = 1 - SIFT4.distance(t1, t2, 5) / Math.max(t1.length, t2.length);
        return similarity > 0.7;
    }

    // matchingEvaluators:
    static sift4matchingevaluator(t1, t2) {
        const similarity = 1 - SIFT4.distance(t1, t2, 5) / Math.max(t1.length, t2.length);
        return similarity;
    }

    // localLengthEvaluators:
    static rewardlengthevaluator(l) {
        if (l < 1) return l;
        return l - 1 / (l + 1);
    }

    static rewardlengthevaluator2(l) {
        return Math.pow(l, 1.5);
    }

    // transpositionCostEvaluators:
    static longertranspositionsaremorecostly(c1, c2) {
        return Math.abs(c2 - c1) / 9 + 1;
    }
}
class SIFT4 {

    distance(s1, s2, maxoffset = 5, options = null) {
        options = new SIFT4Options(options);
        let t1 = options.tokenizer(s1), t2 = options.tokenizer(s2);
        let l1 = t1.length, l2 = t2.length;
        if (l1 === 0) {
            return l2;
        }
        if (l2 === 0) {
            return l1;
        }
        let c1 = 0, c2 = 0, lcss = 0, local_cs = 0, trans = 0, offset_arr = [];
        while (c1 < l1 && c2 < l2) {
            if (options.tokenmatcher(t1[c1], t2[c2])) {
                local_cs += options.matchingevaluator(t1[c1], t2[c2]);
                let isTrans = false;
                let i = 0;
                while (i < offset_arr.length) {
                    let ofs = offset_arr[i];
                    if (c1 <= ofs.c1 || c2 <= ofs.c2) {
                        isTrans = Math.abs(c2 - c1) >= Math.abs(ofs.c2 - ofs.c1);
                        if (isTrans) {
                            trans += options.transpositioncostevaluator(c1, c2);
                        } else {
                            if (!ofs.trans) {
                                ofs.trans = true;
                                trans += options.transpositioncostevaluator(ofs.c1, ofs.c2);
                            }
                        }
                        break;
                    } else {
                        if (c1 > ofs.c2 && c2 > ofs.c1) {
                            offset_arr.splice(i, 1);
                        } else {
                            i++;
                        }
                    }
                }
                offset_arr.push({c1: c1, c2: c2, trans: isTrans});
            } else {
                lcss += options.locallengthevaluator(local_cs);
                local_cs = 0;
                if (c1 !== c2) {
                    c1 = c2 = Math.min(c1, c2);
                }
                for (let i = 0; i < maxoffset; i++) {
                    if ((c1 + i < l1) || (c2 + i < l2)) {
                        if ((c1 + i < l1) && options.tokenmatcher(t1[c1 + i], t2[c2])) {
                            c1 += i - 1;
                            c2 -= 1;
                            break;
                        }
                        if ((c2 + i < l2) && options.tokenmatcher(t1[c1], t2[c2 + i])) {
                            c1 -= 1;
                            c2 += i - 1;
                            break;
                        }
                    }
                }
            }
            c1++;
            c2++;
            if (options.maxdistance) {
                let temporarydistance = options.locallengthevaluator(Math.max(c1, c2)) - options.transpositionsevaluator(lcss, trans);
                if (temporarydistance >= options.maxdistance) {
                    return Math.round(temporarydistance);
                }
            }
            if (c1 >= l1 || c2 >= l2) {
                lcss += options.locallengthevaluator(local_cs);
                local_cs = 0;
                c1 = c2 = Math.min(c1, c2);
            }
        }
        lcss += options.locallengthevaluator(local_cs);
        return Math.round(options.locallengthevaluator(Math.max(l1, l2)) - options.transpositionsevaluator(lcss, trans));
    }
}
class SorensenDice extends ShingleBased {
    constructor(k = 3) {
        super(k);
    }

    distance(s0, s1) {
        return 1.0 - this.similarity(s0, s1);
    }

    similarity(s0, s1) {
        if (s0 === null) {
            throw new TypeError("Argument s0 is NoneType.");
        }
        if (s1 === null) {
            throw new TypeError("Argument s1 is NoneType.");
        }
        if (s0 === s1) {
            return 1.0;
        }
        let union = new Set();
        let profile0 = this.get_profile(s0), profile1 = this.get_profile(s1);
        for (let k in profile0) {
            union.add(k);
        }
        for (let k in profile1) {
            union.add(k);
        }
        let inter = parseInt(Object.keys(profile0).length + Object.keys(profile1).length - union.size);
        return 2.0 * inter / (Object.keys(profile0).length + Object.keys(profile1).length);
    }
}
function default_insertion_cost(char) {
    return 1.0;
}
function default_deletion_cost(char) {
    return 1.0;
}
function default_substitution_cost(char_a, char_b) {
    return 1.0;
}
class WeightedLevenshtein {

    constructor(substitution_cost_fn = default_substitution_cost, insertion_cost_fn = default_insertion_cost, deletion_cost_fn = default_deletion_cost) {
        this.substitution_cost_fn = substitution_cost_fn;
        this.insertion_cost_fn = insertion_cost_fn;
        this.deletion_cost_fn = deletion_cost_fn;
    }

    distance(s0, s1) {
        if (s0 === null) {
            throw new TypeError("Argument s0 is NoneType.");
        }
        if (s1 === null) {
            throw new TypeError("Argument s1 is NoneType.");
        }
        if (s0 === s1) {
            return 0.0;
        }
        if (s0.length === 0) {
            return s1.split('').reduce((cost, char) => cost + this.insertion_cost_fn(char), 0);
        }
        if (s1.length === 0) {
            return s0.split('').reduce((cost, char) => cost + this.deletion_cost_fn(char), 0);
        }

        let v0 = new Array(s1.length + 1).fill(0.0);
        let v1 = new Array(s1.length + 1).fill(0.0);

        for (let i = 1; i < v0.length; i++) {
            v0[i] = v0[i - 1] + this.insertion_cost_fn(s1[i - 1]);
        }

        for (let i = 0; i < s0.length; i++) {
            let s0i = s0[i];
            let deletion_cost = this.deletion_cost_fn(s0i);
            v1[0] = v0[0] + deletion_cost;

            for (let j = 0; j < s1.length; j++) {
                let s1j = s1[j];
                let cost = 0;
                if (s0i !== s1j) {
                    cost = this.substitution_cost_fn(s0i, s1j);
                }
                let insertion_cost = this.insertion_cost_fn(s1j);
                v1[j + 1] = Math.min(v1[j] + insertion_cost, v0[j + 1] + deletion_cost, v0[j] + cost);
            }
            [v0, v1] = [v1, v0];
        }

        return v0[s1.length];
    }
}
function assert_equal(a, b) {
    if (a !== b) {
        throw new Error("MyLogError MISMATCH");
    }
}
function test_levenshtein() {
    let a = new Levenshtein();
    let s0 = "";
    let s1 = "";
    let s2 = input_shanghai;
    let s3 = input_shanghai_city;
    assert_equal(
        a.distance(s0, s1), 0.0);
    assert_equal(
        a.distance(s0, s2), 2);
    assert_equal(
        a.distance(s0, s3), 3);
    assert_equal(
        a.distance(s1, s2), 2);
    assert_equal(
        a.distance(s1, s3), 3);
    assert_equal(
        a.distance(s2, s3), 1);
}
function test_longest_common_subsequence() {
    let a = new LongestCommonSubsequence();
    let s0 = "";
    let s1 = "";
    let s2 = input_shanghai;
    let s3 = input_shanghai_city;
    assert_equal(0, 
                 a.distance(s0, s1));
    assert_equal(2, 
                 a.distance(s0, s2));
    assert_equal(3, 
                 a.distance(s0, s3));
    assert_equal(1, 
                 a.distance(s2, s3));
    assert_equal(2, 
                 a.length(s2, s3));
    assert_equal(4, 
                 a.distance('AGCAT', 'GAC'));
    assert_equal(2, 
                 a.length('AGCAT', 'GAC'));
}
function test_metric_lcs() {
    let a = new MetricLCS();
    let s0 = "";
    let s1 = "";
    let s2 = input_shanghai;
    let s3 = input_shanghai_city;
    console.assert(
        a.distance(s0, s1) === 0.0);
    console.assert(
        a.distance(s0, s2) === 1.0);
    console.assert(
        a.distance(s0, s3) === 1.0);
    console.assert(
        a.distance(s1, s2) === 1.0);
    console.assert(
        a.distance(s1, s3) === 1.0);
    console.assert(
        Math.round(a.distance(s2, s3) * 100) / 100 === 0.33);
}
function test_ngram() {
    let a = new NGram(2);
    let s0 = "";
    let s1 = "";
    let s2 = input_shanghai;
    let s3 = input_shanghai_city;
    assert_equal(a.distance(s0, s1), 0.0);
    assert_equal(a.distance(s0, s2), 1.0);
    assert_equal(a.distance(s0, s3), 1.0);
    assert_equal(a.distance(s1, s2), 1.0);
    assert_equal(a.distance(s1, s3), 1.0);
    assert_equal(Math.round(a.distance(s2, s3) * 100) / 100, 0.33);
}
function test_damerau() {
    let a = new Damerau();
    let s0 = "";
    let s1 = "";
    let s2 = input_shanghai;
    let s3 = input_shanghai_city;
    assert_equal(
        a.distance(s0, s1), 0.0);
    assert_equal(
        a.distance(s0, s2), 2);
    assert_equal(
        a.distance(s0, s3), 3);
    assert_equal(
        a.distance(s1, s2), 2);
    assert_equal(
        a.distance(s1, s3), 3);
    assert_equal(
        a.distance(s2, s3), 1);
}
function test_cosine() {
    let cos = new Cosine(1);
    let s = ['', ' ', 'Shanghai', 'ShangHai', 'Shang Hai'];
    assert_equal(0.0000, 
        parseFloat(cos.distance(s[0], s[0]).toFixed(4)));
    assert_equal(1.0000, 
        parseFloat(cos.similarity(s[0], s[0]).toFixed(4)));
    assert_equal(1.0000, 
        parseFloat(cos.distance(s[0], s[1]).toFixed(4)));
    assert_equal(0.0000, 
        parseFloat(cos.similarity(s[0], s[1]).toFixed(4)));
    assert_equal(1.0000, 
        parseFloat(cos.distance(s[0], s[2]).toFixed(4)));
    assert_equal(0.0000, 
        parseFloat(cos.similarity(s[0], s[2]).toFixed(4)));
    assert_equal(1.0000, 
        parseFloat(cos.distance(s[0], s[3]).toFixed(4)));
    assert_equal(0.0000, 
        parseFloat(cos.similarity(s[0], s[3]).toFixed(4)));
    assert_equal(1.0000, 
        parseFloat(cos.distance(s[0], s[4]).toFixed(4)));
    assert_equal(0.0000, 
        parseFloat(cos.similarity(s[0], s[4]).toFixed(4)));

    assert_equal(0.0000, 
        parseFloat(cos.distance(s[1], s[1]).toFixed(4)));
    assert_equal(1.0000, 
        parseFloat(cos.similarity(s[1], s[1]).toFixed(4)));
    assert_equal(1.0000, 
        parseFloat(cos.distance(s[1], s[2]).toFixed(4)));
    assert_equal(0.0000, 
        parseFloat(cos.similarity(s[1], s[2]).toFixed(4)));
    assert_equal(1.0000, 
        parseFloat(cos.distance(s[1], s[3]).toFixed(4)));
    assert_equal(0.0000, 
        parseFloat(cos.similarity(s[1], s[3]).toFixed(4)));
    assert_equal(0.6985, 
        parseFloat(cos.distance(s[1], s[4]).toFixed(4)));
    assert_equal(0.3015, 
        parseFloat(cos.similarity(s[1], s[4]).toFixed(4)));

    assert_equal(0.0000, 
        parseFloat(cos.distance(s[2], s[2]).toFixed(4)));
    assert_equal(1.0000, 
        parseFloat(cos.similarity(s[2], s[2]).toFixed(4)));
    assert_equal(0.0871, 
        parseFloat(cos.distance(s[2], s[3]).toFixed(4)));
    assert_equal(0.9129, 
        parseFloat(cos.similarity(s[2], s[3]).toFixed(4)));
    assert_equal(0.1296, 
        parseFloat(cos.distance(s[2], s[4]).toFixed(4)));
    assert_equal(0.8704, 
        parseFloat(cos.similarity(s[2], s[4]).toFixed(4)));

    assert_equal(0.0000, 
        parseFloat(cos.distance(s[3], s[3]).toFixed(4)));
    assert_equal(1.0000, 
        parseFloat(cos.similarity(s[3], s[3]).toFixed(4)));
    assert_equal(0.0465, 
        parseFloat(cos.distance(s[3], s[4]).toFixed(4)));
    assert_equal(0.9535, 
        parseFloat(cos.similarity(s[3], s[4]).toFixed(4)));
    
    assert_equal(0.0000, 
        parseFloat(cos.distance(s[4], s[4]).toFixed(4)));
    assert_equal(1.0000, 
        parseFloat(cos.similarity(s[4], s[4]).toFixed(4)));
}
function test_jaccard() {
    let jaccard = new Jaccard(1);
    let s = ['', ' ', 'Shanghai', 'ShangHai', 'Shang Hai'];
    assert_equal(0.0000, 
        parseFloat(jaccard.distance(s[0], s[0]).toFixed(4)));
    assert_equal(1.0000, 
        parseFloat(jaccard.similarity(s[0], s[0]).toFixed(4)));
    assert_equal(1.0000, 
        parseFloat(jaccard.distance(s[0], s[1]).toFixed(4)));
    assert_equal(0.0000, 
        parseFloat(jaccard.similarity(s[0], s[1]).toFixed(4)));
    assert_equal(1.0000, 
        parseFloat(jaccard.distance(s[0], s[2]).toFixed(4)));
    assert_equal(0.0000, 
        parseFloat(jaccard.similarity(s[0], s[2]).toFixed(4)));
    assert_equal(1.0000, 
        parseFloat(jaccard.distance(s[0], s[3]).toFixed(4)));
    assert_equal(0.0000, 
        parseFloat(jaccard.similarity(s[0], s[3]).toFixed(4)));
    assert_equal(1.0000, 
        parseFloat(jaccard.distance(s[0], s[4]).toFixed(4)));
    assert_equal(0.0000, 
        parseFloat(jaccard.similarity(s[0], s[4]).toFixed(4)));

    assert_equal(0.0000, 
        parseFloat(jaccard.distance(s[1], s[1]).toFixed(4)));
    assert_equal(1.0000, 
        parseFloat(jaccard.similarity(s[1], s[1]).toFixed(4)));
    assert_equal(1.0000, 
        parseFloat(jaccard.distance(s[1], s[2]).toFixed(4)));
    assert_equal(0.0000, 
        parseFloat(jaccard.similarity(s[1], s[2]).toFixed(4)));
    assert_equal(1.0000, 
        parseFloat(jaccard.distance(s[1], s[3]).toFixed(4)));
    assert_equal(0.0000, 
        parseFloat(jaccard.similarity(s[1], s[3]).toFixed(4)));
    assert_equal(0.8750, 
        parseFloat(jaccard.distance(s[1], s[4]).toFixed(4)));
    assert_equal(0.1250, 
        parseFloat(jaccard.similarity(s[1], s[4]).toFixed(4)));

    assert_equal(0.0000, 
        parseFloat(jaccard.distance(s[2], s[2]).toFixed(4)));
    assert_equal(1.0000, 
        parseFloat(jaccard.similarity(s[2], s[2]).toFixed(4)));
    assert_equal(0.1429, 
        parseFloat(jaccard.distance(s[2], s[3]).toFixed(4)));
    assert_equal(0.8571, 
        parseFloat(jaccard.similarity(s[2], s[3]).toFixed(4)));
    assert_equal(0.2500, 
        parseFloat(jaccard.distance(s[2], s[4]).toFixed(4)));
    assert_equal(0.7500, 
        parseFloat(jaccard.similarity(s[2], s[4]).toFixed(4)));

    assert_equal(0.0000, 
        parseFloat(jaccard.distance(s[3], s[3]).toFixed(4)));
    assert_equal(1.0000, 
        parseFloat(jaccard.similarity(s[3], s[3]).toFixed(4)));
    assert_equal(0.1250, 
        parseFloat(jaccard.distance(s[3], s[4]).toFixed(4)));
    assert_equal(0.8750, 
        parseFloat(jaccard.similarity(s[3], s[4]).toFixed(4)));
    
    assert_equal(0.0000, 
        parseFloat(jaccard.distance(s[4], s[4]).toFixed(4)));
    assert_equal(1.0000, 
        parseFloat(jaccard.similarity(s[4], s[4]).toFixed(4)));
}
function test_jarowinkler() {
    let a = new JaroWinkler(0.7);
    let s0 = "";
    let s1 = "";
    let s2 = input_shanghai;
    let s3 = input_shanghai_city;

    console.assert(
        a.distance(s0, s1) === 0.0);
    console.assert(
        a.distance(s0, s2) === 1.0);
    console.assert(
        a.distance(s0, s3) === 1.0);
    console.assert(
        a.distance(s1, s2) === 1.0);
    console.assert(
        a.distance(s1, s3) === 1.0);
    console.assert(
        Math.round(a.distance(s2, s3) * 10000) / 10000 === 0.0889);

    console.assert(
        a.similarity(s0, s1) === 1.0);
    console.assert(
        a.similarity(s0, s2) === 0.0);
    console.assert(
        a.similarity(s0, s3) === 0.0);
    console.assert(
        a.similarity(s1, s2) === 0.0);
    console.assert(
        a.similarity(s1, s3) === 0.0);
    console.assert(
        Math.round(a.similarity(s2, s3) * 10000) / 10000 === 0.9111);
}
function test_normalized_levenshtein() {
    let a = new NormalizedLevenshtein();
    let s0 = "";
    let s1 = "";
    let s2 = input_shanghai;
    let s3 = input_shanghai_city;

    console.assert(
        a.distance(s0, s1) === 0.0);
    console.assert(
        a.distance(s0, s2) === 1.0);
    console.assert(
        a.distance(s0, s3) === 1.0);
    console.assert(
        a.distance(s1, s2) === 1.0);
    console.assert(
        a.distance(s1, s3) === 1.0);
    console.assert(
        Math.round(a.distance(s2, s3) * 100) / 100 === 0.33);

    console.assert(
        a.similarity(s0, s1) === 1.0);
    console.assert(
        a.similarity(s0, s2) === 0.0);
    console.assert(
        a.similarity(s0, s3) === 0.0);
    console.assert(
        a.similarity(s1, s2) === 0.0);
    console.assert(
        a.similarity(s1, s3) === 0.0);
    console.assert(
        Math.round(a.similarity(s2, s3) * 100) / 100 === 0.67);
}
function test_optimal_string_alignment() {
    let a = new OptimalStringAlignment();
    let s0 = "";
    let s1 = "";
    let s2 = input_shanghai;
    let s3 = input_shanghai_city;

    console.assert(
        a.distance(s0, s1) === 0.0);
    console.assert(
        a.distance(s0, s2) === 0.0);
    console.assert(
        a.distance(s0, s3) === 0.0);
    console.assert(
        a.distance(s1, s2) === 0.0);
    console.assert(
        a.distance(s1, s3) === 0.0);
    console.assert(
        Math.round(a.distance(s2, s3) * 100) / 100 === 1);
}
function test_overlap_coefficient_0() {
    let sim = new OverlapCoefficient(3);
    let s1 = "eat", s2 = "eating";
    let actual = sim.distance(s1, s2);
    assert_equal(0, actual);
}
function test_overlap_coefficient_1() {
    let sim = new OverlapCoefficient(3);
    let s1 = "eat", s2 = "eating";
    let actual = sim.similarity(s1, s2);
    assert_equal(1, actual);
}
function test_overlap_coefficient_2() {
    let sim = new OverlapCoefficient(3);
    let s1 = "eat", s2 = "eating";
    let actual = sim.similarity(s1, s2);
    assert_equal(1, actual);
}
function test_overlap_coefficient_3() {
    let sim = new OverlapCoefficient(2);
    let s1 = "car", s2 = "bar";
    console.assert(1 / 2 === sim.similarity(s1, s2));
    console.assert(1 / 2 === sim.distance(s1, s2));
}
function test_qgram() {
    let a = new QGram(1);
    let s0 = "";
    let s1 = "";
    let s2 = input_shanghai;
    let s3 = input_shanghai_city;

    assert_equal(a.distance(s0, s1), 0.0);
    assert_equal(a.distance(s0, s2), 2);
    assert_equal(a.distance(s0, s3), 3);
    assert_equal(a.distance(s1, s2), 2);
    assert_equal(a.distance(s1, s3), 3);
    assert_equal(a.distance(s2, s3), 1);
}
function test_sift4() {
    s = new SIFT4();
    
    results = [
        ['This is the first string', 'And this is another string', 5, 11.0],
        ['Lorem ipsum dolor sit amet, consectetur adipiscing elit.', 'Amet Lorm ispum dolor sit amet, consetetur adixxxpiscing elit.', 10, 12.0]
    ];

    for (var i = 0; i < results.length; i++) {
        var a = results[i][0];
        var b = results[i][1];
        var offset = results[i][2];
        var res = results[i][3];
        assert_equal(res, 
                     s.distance(a, b, offset, null));
    }
}
function test_sorensen_dice() {
    let a = new SorensenDice(2);
    let s2 = input_shanghai;
    let s3 = input_shanghai_city;
    console.assert(
        Math.round(a.distance(s2, s3) * 100) / 100 === 0.33);
    console.assert(
        Math.round(a.similarity(s2, s3) * 100) / 100 === 0.67);
}
function test_weighted_levenshtein() {
    let a = new WeightedLevenshtein(default_substitution_cost, default_insertion_cost, default_deletion_cost);
    let s0 = "";
    let s1 = "";
    let s2 = input_shanghai;
    let s3 = input_shanghai_city;

    console.assert(
        a.distance(s0, s1) === 0.0);
    console.assert(
        a.distance(s0, s2) === 2);
    console.assert(
        a.distance(s0, s3) === 3);
    console.assert(
        a.distance(s1, s2) === 2);
    console.assert(
        a.distance(s1, s3) === 3);
    console.assert(
        a.distance(s2, s3) === 1);
}
function test() {
    test_levenshtein();
    test_longest_common_subsequence();
    test_metric_lcs();
    test_ngram();
    test_damerau();

    test_cosine();

    test_jaccard();

    test_jarowinkler();
    test_normalized_levenshtein();
    test_optimal_string_alignment();
    test_overlap_coefficient_0();
    test_overlap_coefficient_1();
    test_overlap_coefficient_2();
    test_overlap_coefficient_3();
    test_qgram();

    test_sift4();

    test_sorensen_dice();
    test_weighted_levenshtein();
    additional_tests();
}
function additional_tests() {
    s = new StringDistance()
    nul = null
    tmp = s.distance("a", "b")
    assert_equal(tmp, nul)

    s = new NormalizedLevenshtein()
    tmp = s.distance("a", "b")
    assert_equal(tmp, 1.0)

    s = new OptimalStringAlignment()
    tmp = s.distance("a", "b")
    assert_equal(tmp, 1)

    s = new NormalizedStringDistance()
    tmp = s.distance("a", "b")
    assert_equal(tmp, nul)
    
    s = new SIFT4()

    results = [
        ['This is the first string', 'And this is another string', 5, 11.0],
        ['Lorem ipsum dolor sit amet, consectetur adipiscing elit.', 'Amet Lorm ispum dolor sit amet, consetetur adixxxpiscing elit.', 10, 12.0]
    ];

    options = {"maxdistance": 0}
    
    for (var i = 0; i < results.length; i++) {
        var a = results[i][0];
        var b = results[i][1];
        var offset = results[i][2];
        var res = results[i][3];
        tmp = s.distance(a, b, offset, options)
        assert_equal(res, 
                     tmp);
    }

    s = new MetricStringDistance()
    tmp = s.distance("a", "b")
    assert_equal(tmp, nul)

    s = new Cosine(1)
    tmp = s.distance("a", "b")
    assert_equal(tmp, 1.0)

    s = new NormalizedStringSimilarity()
    tmp = s.similarity("a", "b")
    assert_equal(tmp, nul)

    s = new StringSimilarity()
    tmp = s.similarity("a", "b")
    assert_equal(tmp, nul)
}

// Global Begin
const _SPACE_PATTERN = /\s+/;
test();