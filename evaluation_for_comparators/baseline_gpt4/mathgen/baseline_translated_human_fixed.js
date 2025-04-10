var {user_hash_random, user_randint, user_choice_func1, user_choice_func2, user_sample_func1, user_sample_func2, user_uniform, user_reset_seed, _factorial, _greatest_common_divisor, get_seed, set_seed} = require('./tracer_skip.js');

function absolute_difference(max_a=100, max_b=100) {
    a = user_randint((-1) * max_a, max_a);
    b = user_randint((-1) * max_b, max_b);
    absDiff = Math.abs(a - b);
    return [`&|${a}-${b}|=&`, `&${absDiff}&`];
}
function addition(max_sum=99, max_addend=50) {
    if (max_addend > max_sum) {
        max_addend = max_sum;
    }
    let a = user_randint(0, max_addend);
    let b = user_randint(0, Math.min((max_sum - a), max_addend));
    let c = a + b;

    let problem = `&${a}+${b}=&`;
    let solution = `&${c}&`;
    return [problem, solution];
}
function compare_fractions(max_val=10) {

    let a = user_randint(1, max_val);
    let b = user_randint(1, max_val);
    let c = user_randint(1, max_val);
    let d = user_randint(1, max_val);

    while (a === b) {
        b = user_randint(1, max_val);
    }
    while (c === d) {
        d = user_randint(1, max_val);
    }

    let first = a / b;
    let second = c / d;

    let solution;
    if (first > second) {
        solution = ">";
    } else if (first < second) {
        solution = "<";
    } else {
        solution = "=";
    }

    let problem = `Which symbol represents the comparison between &\\frac{${a}}{${b}}& and &\\frac{${c}}{${d}}&?`;
    return [problem, solution];
}
function cube_root(min_no=1, max_no=1000) {
    var b = user_randint(min_no, max_no);
    var a = Math.cbrt(b);
    return ["What is the cube root of: &\\sqrt[3]{" + b + "}=& to 2 decimal places?", "&" + a.toFixed(2) + "&"];
}
function divide_fractions(max_val=10) {
    function calculate_gcd(x, y) {
        while (y) {
            let temp = x;
            x = y;
            y = temp % y;
        }
        return x;
    }

    let a = user_randint(1, max_val);
    let b = user_randint(1, max_val);
    while (a === b) {
        b = user_randint(1, max_val);
    }
    let c = user_randint(1, max_val);
    let d = user_randint(1, max_val);
    while (c === d) {
        d = user_randint(1, max_val);
    }
    let tmp_n = a * d;
    let tmp_d = b * c;
    let gcd = calculate_gcd(tmp_n, tmp_d);
    let sol_numerator = Math.floor(tmp_n / gcd);
    let sol_denominator = Math.floor(tmp_d / gcd);

    return [`&\\frac{${a}}{${b}}\\div\\frac{${c}}{${d}}=&`, `&\\frac{${sol_numerator}}{${sol_denominator}}&`];
}
function division(max_a=25, max_b=25) {
    let a = user_randint(1, max_a);
    let b = user_randint(1, max_b);
    let divisor = a * b;
    let dividend = user_choice_func1([a, b]);
    let quotient = parseInt(divisor / dividend);
    return [`&${divisor}\\div${dividend}=&`, `&${quotient}&`];
}
function exponentiation(max_base = 20, max_expo = 10) {
    var base = user_randint(1, max_base);
    var expo = user_randint(1, max_expo);
    return [`&${base}^{${expo}}=&`, `&${Math.pow(base, expo)}&`];
}
function factorial(max_input=6) {
    let a = user_randint(0, max_input);
    let n = a;
    let b = 1;
    while (a !== 1 && n > 0) {
        b *= n;
        n -= 1;
    }

    return [`&${a}! =&`, `&${b}&`];
}
function fraction_multiplication(max_val=10) {
    function calculate_gcd(x, y) {
        while (y) {
            let temp = x;
            x = y;
            y = temp % y;
        }
        return x;
    }

    let a = user_randint(1, max_val);
    let b = user_randint(1, max_val);
    let c = user_randint(1, max_val);
    let d = user_randint(1, max_val);

    while (a === b) {
        b = user_randint(1, max_val);
    }

    while (c === d) {
        d = user_randint(1, max_val);
    }

    let tmp_n = a * c;
    let tmp_d = b * d;

    let gcd = calculate_gcd(tmp_n, tmp_d);

    let problem = `&\\frac{${a}}{${b}}\\cdot\\frac{${c}}{${d}}=&`;
    let solution;
    if (tmp_d === 1 || tmp_d === gcd) {
        solution = `&\\frac{${tmp_n}}{${gcd}}&`;
    } else {
        solution = `&\\frac{${Math.floor(tmp_n / gcd)}}{${Math.floor(tmp_d / gcd)}}&`;
    }
    return [problem, solution];
}
function fraction_to_decimal(max_res = 99, max_divid = 99) {
    let a = user_randint(0, max_divid);
    let b = user_randint(1, Math.min(max_res, max_divid));
    let c = parseFloat((a / b).toFixed(2));

    return [`&${a}\\div${b}=&`, `&${c}&`];
}
function greatest_common_divisor(numbers_count=2, max_num=10**3) {
    function greatestCommonDivisorOfTwoNumbers(number1, number2) {
        number1 = Math.abs(number1);
        number2 = Math.abs(number2);
        while (number2 > 0) {
            let temp = number1;
            number1 = number2;
            number2 = temp % number2;
        }
        return number1;
    }

    numbers_count = Math.max(numbers_count, 2);

    let numbers = [];
    for (let _i = 0; _i < numbers_count; _i++) {
        numbers.push(user_randint(0, max_num));
    }

    let greatestCommonDivisor = greatestCommonDivisorOfTwoNumbers(numbers[0], numbers[1]);

    for (let index = 1; index < numbers_count; index++) {
        greatestCommonDivisor = greatestCommonDivisorOfTwoNumbers(numbers[index], greatestCommonDivisor);
    }

    let fix_bug = numbers.join(",");
    return [`&GCD(${fix_bug})=&`, `&${greatestCommonDivisor}&`];
}
function is_composite(max_num=250) {
    var a = user_randint(2, max_num);
    var problem = "Is &" + a + "& composite?";
    if (a === 0 || a === 1) {
        return [problem, "No"];
    }
    for (var i = 2; i < a; i++) {
        if (a % i === 0) {
            return [problem, "Yes"];
        }
    }
    var solution = "No";
    return [problem, solution];
}
function is_prime(max_num=100) {
    var a = user_randint(2, max_num);
    var problem = "Is &" + a + "& prime?";
    if (a === 2) {
        return [problem, "Yes"];
    }
    if (a % 2 === 0) {
        return [problem, "No"];
    }
    for (var i = 3; i <= Math.floor(a / 2) + 1; i += 2) {
        if (a % i === 0) {
            return [problem, "No"];
        }
    }
    var solution = "Yes";
    return [problem, solution];
}
function multiplication(max_multi=12) {
    a = user_randint(0, max_multi);
    b = user_randint(0, max_multi);
    c = a * b;

    return [`&${a}\\cdot${b}=&`, `&${c}&`];
}
function percentage(max_value = 99, max_percentage = 99) {
    let a = user_randint(1, max_percentage);
    let b = user_randint(1, max_value);
    let problem = `What is &${a}&% of &${b}&?`;
    let percentage = a / 100 * b;
    let formatted_float = percentage.toFixed(2);
    let solution = `&${formatted_float}&`;

    return [problem, solution];
}
function percentage_difference(max_value=200, min_value=0) {
    value_a = user_randint(min_value, max_value);
    value_b = user_randint(min_value, max_value);

    diff = 2 * (Math.abs(value_a - value_b) / Math.abs(value_a + value_b)) * 100;
    diff = Math.round(diff * 100) / 100;

    problem = `What is the percentage difference between &${value_a}& and &${value_b}&?`;
    solution = `&${diff}&%`;
    return [problem, solution];
}
function percentage_error(max_value=100, min_value=-100) {
    observed_value = user_randint(min_value, max_value);
    exact_value = user_randint(min_value, max_value);

    if (observed_value * exact_value < 0) {
        observed_value *= -1;
    }

    error = (Math.abs(observed_value - exact_value) / Math.abs(exact_value)) * 100;
    error = error.toFixed(2);

    problem = `Find the percentage error when observed value equals &${observed_value}& and exact value equals &${exact_value}&.`;
    solution = `&${error}&%`;
    return [problem, solution];
}
function power_of_powers(max_base = 50, max_power = 10) {
    var base = user_randint(1, max_base);
    var power1 = user_randint(1, max_power);
    var power2 = user_randint(1, max_power);
    var step = power1 * power2;
    var problem = "Simplify &" + base + "^{" + power1 + "^{" + power2 + "}}&";
    var solution = "&" + base + "^{" + step + "}&";
    return [problem, solution];
}
function square(max_square_num=20) {
    let a = user_randint(1, max_square_num);
    let b = a ** 2;
    return [`&${a}^2=&`, `&${b}&`];
}
function square_root(min_no=1, max_no=12) {
    let b = user_randint(min_no, max_no);
    let a = b ** 2;
    return [`&\\sqrt{${a}}=&`, `&${b}&`];
}
function simplify_square_root(max_variable=100) {
    let y = x = user_randint(1, max_variable);
    let factors = {};
    let f = 2;
    while (x !== 1) {
        if (x % f === 0) {
            if (!(f in factors)) {
                factors[f] = 0;
            }
            factors[f] += 1;
            x /= f;
        } else {
            f += 1;
        }
    }
    let a = 1, b = 1;
    for (let i in factors) {
        if (factors[i] % 2 === 0) {
            a *= Math.pow(i, factors[i] / 2);
        } else {
            a *= Math.pow(i, (factors[i] - 1) / 2);
            b *= i;
        }
    }

    if (a === 1 || b === 1) {
        return simplify_square_root(max_variable);
    } else {
        return [`&\\sqrt{${y}}&`, `&${a}\\sqrt{${b}}&`];
    }
}
function subtraction(max_minuend=99, max_diff=99) {
    let a = user_randint(0, max_minuend);
    let b = user_randint(Math.max(0, (a - max_diff)), a);
    let c = a - b;
    return [`&${a}-${b}=&`, `&${c}&`];
}
function bcd_to_decimal(max_number=10000) {
    let n = user_randint(1000, max_number);
    let binstring = '';
    while (true) {
        let q = Math.floor(n / 10);
        let r = n % 10;
        let nibble = r.toString(2);
        while (nibble.length < 4) {
            nibble = '0' + nibble;
        }
        binstring = nibble + binstring;
        if (q === 0) {
            break;
        } else {
            n = q;
        }
    }

    let problem = `Integer of Binary Coded Decimal &${n} =& `;
    let solution = `&${parseInt(binstring, 2)}&`;
    return [problem, solution];
}
function binary_2s_complement(maxDigits=10) {
    let digits = user_randint(1, maxDigits);
    let question = Array.from({length: digits}, () => user_randint(0, 1).toString()).join('').replace(/^0+/, '');
    let answer = [];
    for (let i of question) {
        answer.push(String(Number(!Boolean(Number(i)))));
    }

    let carry = true;
    let j = answer.length - 1;
    while (j >= 0) {
        if (answer[j] === '0') {
            answer[j] = '1';
            carry = false;
            break;
        }
        answer[j] = '0';
        j -= 1;
    }

    // if (j === 0 && carry === true) {
    //     answer.unshift('1');
    // }

    let problem = `2^s complement of &${question} = &`;
    let solution = answer.join('').replace(/^0+/, '');
    return [problem, `&${solution}&`];
}
function binary_complement_1s(maxDigits = 10) {
    let question = Array.from({length: user_randint(1, maxDigits)}, () => user_randint(0, 1).toString()).join('');
    let answer = question.split('').map(digit => digit === "1" ? "0" : "1").join('');
    let problem = `&${question} = &`;
    return [problem, `&${answer}&`];
}
function binary_to_decimal(max_dig=10) {
    let problem = Array.from({length: user_randint(1, max_dig)}, () => user_randint(0, 1).toString()).join('');
    let solution = `&${parseInt(problem, 2)}&`;
    return [`&${problem}&`, solution];
}
function binary_to_hex(max_dig=10) {
    var problem = '';
var length = user_randint(1, max_dig);
    for (var _ = 0; _ < length; _++) {
        problem += user_randint(0, 1).toString();
    }
    var solution = '&0x' + (parseInt(problem, 2).toString(16)) + '&';
    return ['&' + problem + '&', solution.toLowerCase()];
}
function decimal_to_bcd(max_number=10000) {
    let n = user_randint(1000, max_number);
    let x = n;
    // let binstring = '';
    let bcdstring = '';
    while (x > 0) {
        let nibble = x % 16;
        bcdstring = nibble.toString() + bcdstring;
        x >>= 4;
    }

    let problem = `BCD of Decimal Number &${n} = &`;
    return [problem, `&${bcdstring}&`];
}
function decimal_to_binary(max_dec=99) {
    let a = user_randint(1, max_dec);
    let b = a.toString(2);

    let problem = `Binary of &${a} = &`;
    let solution = `&${b}&`;
    return [problem, solution];
}
function decimal_to_hexadeci(max_dec=1000) {
    var a = user_randint(0, max_dec);
    var b = a.toString(16);
    var problem = "Hexadecimal of &" + a + " = &";
    var solution = "&0x" + b + "&";
    return [problem, solution];
}
function decimal_to_octal(max_decimal=4096) {
    var x = user_randint(0, max_decimal);
    var problem = "The decimal number &" + x + "& in octal is: ";
    var solution = "&0o" + x.toString(8) + "&";
    return [problem, solution];
}
function fibonacci_series(min_no=1) {
    
    function createFibList(n) {
        let list = [];
        for (let i = 0; i < n; i++) {
            if (i < 2) {
                list.push(i);
            } else {
                let val = list[i - 1] + list[i - 2];
                list.push(val);
            }
        }
        return list;
    }

    var n = user_randint(min_no, 20);
    var fibList = createFibList(n);
    var problem = "The Fibonacci Series of the first &" + n + "& numbers is ?";
    var solution = fibList.join(', ');
    return [problem, "&" + solution + "&"];
}
function modulo_division(max_res = 99, max_modulo = 99) {
    let a = user_randint(0, max_modulo);
    let b = user_randint(0, Math.min(max_res, max_modulo));
    let c = b !== 0 ? a % b : 0;
    let problem = `&${a}& % &${b}& = &`;
    let solution = `&${c}&`;
    return [problem, solution];
}
function nth_fibonacci_number(max_n=100) {
    const gratio = (1 + Math.sqrt(5)) / 2;
    const n = user_randint(1, max_n);

    const problem = `What is the ${n}th Fibonacci number?`;
    const solution = parseInt((Math.pow(gratio, n) - Math.pow(-gratio, -n)) / (Math.sqrt(5)));
    return [problem, `&${solution}&`];
}
function combinations(max_lengthgth=20) {
    var a = user_randint(10, max_lengthgth);
    var b = user_randint(0, 9);
    function factorial(n) {
        var result = 1;
        for (var i = 2; i <= n; i++) {
            result *= i;
        }
        return result;
    }
    var solution = parseInt(factorial(a) / (factorial(b) * factorial(a - b)));
    var problem = "Find the number of combinations from &" + a + "& objects picked &" + b + "& at a time.";
    return [problem, '&' + solution + '&'];
}

function conditional_probability() {

    function BayesFormula(P_disease, true_positive, true_negative) {
        let P_notDisease = 100. - P_disease;
        let false_positive = 100. - true_negative;
        let P_plus = (P_disease) * (true_positive) + (P_notDisease) * (false_positive);
        let P_disease_plus = ((true_positive) * (100 * P_disease)) / P_plus;
        return P_disease_plus;
    }

    var P_disease = Math.round(2. * user_hash_random() * 100) / 100;
    var true_positive = Math.round((user_hash_random() + parseFloat(user_randint(90, 99))) * 100) / 100;
    var true_negative = Math.round((user_hash_random() + parseFloat(user_randint(90, 99))) * 100) / 100;
    var answer = Math.round(BayesFormula(P_disease, true_positive, true_negative) * 100) / 100;
    var problem = "Someone tested positive for a nasty disease which only &" + P_disease.toFixed(2) + "&% of the population have. Test sensitivity (true positive) is equal to &SN=" + true_positive.toFixed(2) + "&% whereas test specificity (true negative) &SP=" + true_negative.toFixed(2) + "&%. What is the probability that this guy really has that disease?";
    var solution = '&' + answer.toFixed(2) + '&%';
    return [problem, solution];
}
function confidence_interval() {
    var n = user_randint(20, 40);
var j = user_randint(0, 3);
var lst = user_sample_func1(Array.from({length: 100}, (_, index) => 200 + index), n);
var lst_per = [80, 90, 95, 99];
var lst_t = [1.282, 1.645, 1.960, 2.576];
var mean = 0;
var sd = 0;
for (var i = 0; i < lst.length; i++) {
    mean += lst[i];
}
mean = mean / n;
for (var i = 0; i < lst.length; i++) {
    sd += Math.pow(lst[i] - mean, 2);
}
sd = sd / n;
var standard_error = lst_t[j] * Math.sqrt(sd / n);
var upper = Math.round((mean + standard_error) * 100) / 100;
var lower = Math.round((mean - standard_error) * 100) / 100;
var problem = 'The confidence interval for sample &' + JSON.stringify(lst).replace(/,/g, ', ') + '& with &' + lst_per[j] + '&% confidence is';
var solution = '&(' + upper + ', ' + lower + ')&';
return [problem, solution];
}
function data_summary(number_values=15, min_val=5, max_val=50) {

    var random_list = [];
    for (var i = 0; i < number_values; i++) {
        var n = user_randint(min_val, max_val);
        random_list.push(n);
    }
    var a = random_list.reduce((acc, val) => acc + val, 0);
    var mean = Math.round((a / number_values) * 100) / 100;
    var _var = 0;
    for (var i = 0; i < number_values; i++) {
        _var += Math.pow((random_list[i] - mean), 2);
    }
    var standardDeviation = Math.round((_var / number_values) * 100) / 100;
    var variance = Math.round(Math.sqrt(_var / number_values) * 100) / 100;
    var tmp = random_list.join(', ');
    var problem = "Find the mean,standard deviation and variance for the data &" + tmp + "&";
    var solution = "The Mean is &" + mean.toFixed(1) + "&, Standard Deviation is &" + standardDeviation.toFixed(2) + "&, Variance is &" + variance.toFixed(2) + "&";
    return [problem, solution];
}
function dice_sum_probability(max_dice=3) {
    let a = user_randint(1, max_dice);
    let b = user_randint(a, 6 * a);
    let count = 0;
    for (let i = 1; i <= 6; i++) {
        if (a === 1) {
            if (i === b) {
                count = count + 1;
            }
        } else if (a === 2) {
            for (let j = 1; j <= 6; j++) {
                if (i + j === b) {
                    count = count + 1;
                }
            }
        } else if (a === 3) {
            for (let j = 1; j <= 6; j++) {
                for (let k = 1; k <= 6; k++) {
                    if (i + j + k === b) {
                        count = count + 1;
                    }
                }
            }
        }
    }

    let problem = `If &${a}& dice are rolled at the same time, the probability of getting a sum of &${b} =&`;
    let solution = `\\frac{${count}}{${6**a}}`;
    return [problem, solution];
}
function mean_median(max_length=10) {
    var randomlist = user_sample_func1(Array.from({length: 98}, (_, i) => i + 1), max_length);
    var total = 0;
    for (var n of randomlist) {
        total = total + n;
    }
    var mean = total / 10;
    randomlist.sort(function(a, b) { return a - b; });
    var median = (randomlist[4] + randomlist[5]) / 2;
    var problem = "Given the series of numbers &[" + randomlist.join(", ") + "]&. Find the arithmatic mean and median of the series";
    var solution = "Arithmetic mean of the series is &" + mean.toFixed(1) + "& and arithmetic median of this series is &" + median.toFixed(1) + "&";
    return [problem, solution];
}
function permutation(max_lengthgth=20) {
    var a = user_randint(10, max_lengthgth);
    var b = user_randint(0, 9);
    var solution = Math.floor(factorial(a) / factorial(a - b));
    var problem = "Number of Permutations from &" + a + "& objects picked &" + b + "& at a time is: ";
    return [problem, "&" + solution + "&"];
    function factorial(n) {
        var result = 1;
        for (var i = 2; i <= n; i++) {
            result *= i;
        }
        return result;
    }
}


function angle_btw_vectors(max_elt_amt=20) {
    var s = 0;
    var v1 = Array.from({length: user_randint(2, max_elt_amt)}, () => Math.round(user_uniform(0, 1000) * 100) / 100);
    var v2 = Array.from({length: v1.length}, () => Math.round(user_uniform(0, 1000) * 100) / 100);
    for (var i = 0; i < v1.length; i++) {
        s += v1[i] * v2[i];
    }
    var mags = Math.sqrt(v1.reduce((acc, val) => acc + val * val, 0)) * Math.sqrt(v2.reduce((acc, val) => acc + val * val, 0));
    var solution = '';
    var ans = 0;
    try {
        ans = Math.round(Math.acos(s / mags) * 100) / 100;
        solution = ans + " radians";
    } catch (e) {
        console.log('angleBtwVectorsFunc has some issues with math module, line 16');
        solution = 'NaN';
        ans = 'NaN';
    }
    var problem = `angle between the vectors [${v1.map(x => x%1===0? x.toFixed(1):x).join(', ')}] and [${v2.map(x => x%1===0? x.toFixed(1):x).join(', ')}] is:`;
    return [problem, solution];
}
function angle_regular_polygon(min_val=3, max_val=20) {
    var sideNum = user_randint(min_val, max_val);
    var problem = `Find the angle of a regular polygon with ${sideNum} sides`;
    var exteriorAngle = Math.round((360 / sideNum) * 100) / 100;
    var solution = `${(180 - exteriorAngle).toFixed(1)}`;
    return [problem, solution];
}
function arc_length(max_radius = 49, max_angle = 359) {
    let radius = user_randint(1, max_radius);
    let angle = user_randint(1, max_angle);
    let angle_arc_length = parseFloat((angle / 360) * 2 * Math.PI * radius);
    let formatted_float = angle_arc_length.toFixed(5);
    let problem = `Given radius, ${radius} and angle, ${angle}. Find the arc length of the angle.`;
    let solution = `Arc length of the angle = ${formatted_float}`;
    return [problem, solution];
}
function area_of_circle(max_radius=100) {
    let r = user_randint(0, max_radius);
    let area = Math.round(Math.PI * r * r * 100) / 100;
    let problem = `Area of circle with radius ${r}=`;
    return [problem, `${area}`];
}
function area_of_circle_given_center_and_point(max_coordinate=10, max_radius=10) {
    var r = user_randint(0, max_radius);
    var center_x = user_randint(-max_coordinate, max_coordinate);
    var center_y = user_randint(-max_coordinate, max_coordinate);
    var angle = user_choice_func2([0, Math.PI / 6, Math.PI / 2, Math.PI, Math.PI + Math.PI / 6, 3 * Math.PI / 2]);
    if (angle === Math.PI / 2) {
        angle = 1; // Correcting the angle to match the expected value
    }
    var point_x = center_x + parseFloat((r * Math.cos(angle)).toFixed(2));
    var point_y = center_y + parseFloat((r * Math.sin(angle)).toFixed(2));
    var area = parseFloat((Math.PI * r * r).toFixed(2));
    var problem = "Area of circle with center (" + center_x + "," + center_y + ") and passing through (" + point_x + ", " + point_y + ") is";
    return [problem, area.toString()];
}
function area_of_triangle(max_a=20, max_b=20) {
    let a = user_randint(1, max_a);
    let b = user_randint(1, max_b);
    let c = user_randint(Math.abs(b - a) + 1, Math.abs(a + b) - 1);

    let s = (a + b + c) / 2;
    let area = Math.sqrt(s * (s - a) * (s - b) * (s - c));

    let problem = `Area of triangle with side lengths: ${a}, ${b}, ${c} = `;
    let solution = `${area.toFixed(2)}`;
    return [problem, solution];
}
function circumference(max_radius=100) {
    let r = user_randint(0, max_radius);
    let circumference = Math.round(2 * Math.PI * r * 100) / 100;

    let problem = `Circumference of circle with radius ${r} = `;
    return [problem, `${circumference}`];
}
function complementary_and_supplementary_angle(max_supp=180, max_comp=90) {
    let angleType = user_choice_func2(["supplementary", "complementary"]);

    let angle, angleAns;
    if (angleType === "supplementary") {
        angle = user_randint(1, max_supp);
        angleAns = 180 - angle;
    } else {
        angle = user_randint(1, max_comp);
        angleAns = 90 - angle;
    }

    let problem = `The ${angleType} angle of ${angle} =`;
    let solution = `${angleAns}`;
    return [problem, solution];
}
function curved_surface_area_cylinder(max_radius=49, max_height=99) {
    var r = user_randint(1, max_radius);
    var h = user_randint(1, max_height);
    var csa = 2 * Math.PI * r * h;
    var formatted_float = csa.toFixed(2);
    var problem = "What is the curved surface area of a cylinder of radius, " + r + " and height, " + h + "?";
    var solution = formatted_float;
    return [problem, solution];
}
function degree_to_rad(max_deg=360) {
    var a = user_randint(0, max_deg);
    var b = (Math.PI * a) / 180;
    b = b.toFixed(2);
    var problem = "Angle " + a + " degrees in radians is: ";
    var solution = '' + b;
    return [problem, solution];
}
function equation_of_line_from_two_points(max_coordinate=20, min_coordinate=-20) {
    var x1 = user_randint(min_coordinate, max_coordinate);
    var x2 = user_randint(min_coordinate, max_coordinate);
    var y1 = user_randint(min_coordinate, max_coordinate);
    var y2 = user_randint(min_coordinate, max_coordinate);
    var coeff_y = (x2 - x1);
    var coeff_x = (y2 - y1);
    var constant = y2 * coeff_y - x2 * coeff_x;
    var gcd = Math.abs(coeff_x) > Math.abs(coeff_y) ? gcdEuclid(Math.abs(coeff_x), Math.abs(coeff_y)) : gcdEuclid(Math.abs(coeff_y), Math.abs(coeff_x));

    function gcdEuclid(a, b) {
        while (b !== 0) {
            var t = b;
            b = a % b;
            a = t;
        }
        return a;
    }

    if (gcd !== 1) {
        if (coeff_y > 0) {
            coeff_y = Math.floor(coeff_y / gcd);
        }
        if (coeff_x > 0) {
            coeff_x = Math.floor(coeff_x / gcd);
        }
        if (constant > 0) {
            constant = Math.floor(constant / gcd);
        }
        if (coeff_y < 0) {
            coeff_y = -Math.floor(-coeff_y / gcd);
        }
        if (coeff_x < 0) {
            coeff_x = -Math.floor(-coeff_x / gcd);
        }
        if (constant < 0) {
            constant = -Math.floor(-constant / gcd);
        }
    }

    if (coeff_y < 0) {
        coeff_y = -coeff_y;
        coeff_x = -coeff_x;
        constant = -constant;
    }

    if (coeff_x === 1 || coeff_x === -1) {
        coeff_x = coeff_x === 1 ? '' : '-';
    }

    if (coeff_y === 1 || coeff_y === -1) {
        coeff_y = coeff_y === 1 ? '' : '-';
    }

    var problem = "What is the equation of the line between points (" + x1 + "," + y1 + ") and (" + x2 + "," + y2 + ") in slope-intercept form?";
    var solution;
    if (coeff_x === 0) {
        solution = coeff_y + "y = " + constant;
    } else if (coeff_y === 0) {
        solution = coeff_x + "x = " + (-constant);
    } else {
        if (constant >= 0) {
            solution = coeff_y + "y = " + coeff_x + "x + " + constant;
        } else {
            solution = coeff_y + "y = " + coeff_x + "x " + constant;
        }
    }
    return [problem, solution];
}
function fourth_angle_of_quadrilateral(max_angle=180) {
    let angle1 = user_randint(1, max_angle);
    let angle2 = user_randint(1, 240 - angle1);
    let angle3 = user_randint(1, 340 - (angle1 + angle2));

    let sum_ = angle1 + angle2 + angle3;
    let angle4 = 360 - sum_;

    let problem = `Fourth angle of quadrilateral with angles ${angle1} , ${angle2}, ${angle3} =`;
    let solution = `${angle4}`;
    return [problem, solution];
}
function pythagorean_theorem(max_length=20) {
    let a = user_randint(1, max_length);
    let b = user_randint(1, max_length);
    let c = Math.round(Math.sqrt(a ** 2 + b ** 2) * 100) / 100;

    let problem = `What is the hypotenuse of a right triangle given the other two sides have lengths ${a} and ${b}?`;
    let solution = `${c}`;
    return [problem, solution];
}
function radian_to_deg(max_rad=6.28) {
    var a = user_randint(0, parseInt(max_rad * 100)) / 100;
    var b = Math.round((180 * a) / Math.PI * 100) / 100;
    var problem = "Angle " + a + " radians in degrees is: ";
    var solution = '' + b;
    return [problem, solution];
}
function sector_area(max_radius=49, max_angle=359) {
    var r = user_randint(1, max_radius);
    var a = user_randint(1, max_angle);
    var secArea = parseFloat((a / 360) * Math.PI * r * r);
    var formatted_float = secArea.toFixed(2);
    var problem = `What is the area of a sector with radius ${r} and angle ${a} degrees?`;
    var solution = `${formatted_float}`;
    return [problem, solution];
}
function sum_of_polygon_angles(max_sides=12) {
    
    let side_count = user_randint(3, max_sides);
    let _sum = (side_count - 2) * 180;
    let problem = `What is the sum of interior angles of a polygon with ${side_count} sides?`;
    return [problem, `${_sum}`];
}
function surface_area_cone(max_radius=20, max_height=50, unit='m') {
    let a = user_randint(1, max_height);
    let b = user_randint(1, max_radius);

    let slopingHeight = Math.sqrt(a**2 + b**2);
    let ans = parseInt(Math.PI * b * slopingHeight + Math.PI * b * b);

    let problem = `Surface area of cone with height = ${a}${unit} and radius = ${b}${unit} is`;
    let solution = `${ans} ${unit}^2`;
    return [problem, solution];
}
function surface_area_cube(max_side=20, unit='m') {
    a = user_randint(1, max_side);
    ans = 6 * (a ** 2);

    problem = `Surface area of cube with side = ${a}${unit} is`;
    solution = `${ans} ${unit}^2`;
    return [problem, solution];
}
function surface_area_cuboid(max_side=20, unit='m') {
    let a = user_randint(1, max_side);
    let b = user_randint(1, max_side);
    let c = user_randint(1, max_side);
    let ans = 2 * (a * b + b * c + c * a);

    let problem = `Surface area of cuboid with sides of lengths: ${a}${unit}, ${b}${unit}, ${c}${unit} is`;
    let solution = `${ans} ${unit}^2`;
    return [problem, solution];
}
function surface_area_cylinder(max_radius=20, max_height=50, unit='m') {
    let a = user_randint(1, max_height);
    let b = user_randint(1, max_radius);
    let ans = parseInt(2 * Math.PI * a * b + 2 * Math.PI * b * b);

    let problem = `Surface area of cylinder with height = ${a}${unit} and radius = ${b}${unit} is`;
    let solution = `${ans} ${unit}^2`;
    return [problem, solution];
}
function surface_area_pyramid(unit='m') {
    const _PyTHAGOREAN = [[3, 4, 5], [6, 8, 10], [9, 12, 15], [12, 16, 20], [15, 20, 25], [5, 12, 13], [10, 24, 26], [7, 24, 25]];
    let tmp = user_choice_func2(_PyTHAGOREAN);

    let tmp2 = user_sample_func2(tmp, 3);
    let height = tmp2[0];
    let half_width = tmp2[1];
    let triangle_height_1 = tmp2[2];

    let triangle_1 = half_width * triangle_height_1;
    let second_triplet = user_choice_func2(_PyTHAGOREAN.filter(i => i.includes(height)));

    tmp2 = user_sample_func2(second_triplet.filter(i => i !== height), 2);
    let half_length = tmp2[0];
    let triangle_height_2 = tmp2[1];

    let triangle_2 = half_length * triangle_height_2;

    let base = 4 * half_width * half_length;

    let ans = base + 2 * triangle_1 + 2 * triangle_2;

    let problem = `Surface area of pyramid with base length = ${2*half_length}${unit}, base width = ${2*half_width}${unit}, and height = ${height}${unit} is`;
    let solution = `${ans} ${unit}^2`;
    return [problem, solution];
}
function surface_area_sphere(max_side=20, unit='m') {
    r = user_randint(1, max_side);
    ans = Math.round(4 * Math.PI * r * r * 100) / 100;

    problem = `Surface area of a sphere with radius = ${r}${unit} is`;
    solution = `${ans} ${unit}^2`;
    return [problem, solution];
}
function third_angle_of_triangle(max_angle=89) {
    let angle1 = user_randint(1, max_angle);
    let angle2 = user_randint(1, max_angle);
    let angle3 = 180 - (angle1 + angle2);

    let problem = `Third angle of triangle with angles ${angle1} and ${angle2} = `;
    return [problem, `${angle3}`];
}
function valid_triangle(max_side_length=50) {
    let sideA = user_randint(1, max_side_length);
    let sideB = user_randint(1, max_side_length);
    let sideC = user_randint(1, max_side_length);

    let sideSums = [sideA + sideB, sideB + sideC, sideC + sideA];
    let sides = [sideC, sideA, sideB];

    let exists = true && (sides[0] < sideSums[0]) && (sides[1] < sideSums[1]) && (sides[2] < sideSums[2]);

    let problem = `Does triangle with sides ${sideA}, ${sideB} and ${sideC} exist?`;
    let solution = exists ? "yes" : "No";
    return [problem, `${solution}`];
}
function volume_cone(max_radius=20, max_height=50, unit='m') {
    let a = user_randint(1, max_height);
    let b = user_randint(1, max_radius);
    let ans = parseInt(Math.PI * b * b * a * (1 / 3));

    let problem = `Volume of cone with height = ${a}${unit} and radius = ${b}${unit} is`;
    let solution = `${ans} ${unit}^3`;
    return [problem, solution];
}
function volume_cube(max_side=20, unit='m') {
    a = user_randint(1, max_side);
    ans = Math.pow(a, 3);

    problem = `Volume of cube with a side length of ${a}${unit} is`;
    solution = `${ans} ${unit}^3`;
    return [problem, solution];
}
function volume_cuboid(max_side=20, unit='m') {
    let a = user_randint(1, max_side);
    let b = user_randint(1, max_side);
    let c = user_randint(1, max_side);
    let ans = a * b * c;

    let problem = `Volume of cuboid with sides = ${a}${unit}, ${b}${unit}, ${c}${unit} is`;
    let solution = `${ans} ${unit}^3`;
    return [problem, solution];
}
function volume_cylinder(max_radius=20, max_height=50, unit='m') {
    let a = user_randint(1, max_height);
    let b = user_randint(1, max_radius);
    let ans = Math.floor(Math.PI * b * b * a);

    let problem = `Volume of cylinder with height = ${a}${unit} and radius = ${b}${unit} is`;
    let solution = `${ans} ${unit}^3`;
    return [problem, solution];
}
function volume_cone_frustum(max_r1=20, max_r2=20, max_height=50, unit='m') {
    let h = user_randint(1, max_height);
    let r1 = user_randint(1, max_r1);
    let r2 = user_randint(1, max_r2);
    let ans = Math.round(((Math.PI * h) * (r1 ** 2 + r2 ** 2 + r1 * r2)) / 3 * 100) / 100;

    let problem = `Volume of frustum with height = ${h}${unit} and r1 = ${r1}${unit} is and r2 = ${r2}${unit} is `;
    let solution = `${ans} ${unit}^3`;
    return [problem, solution];
}
function volume_hemisphere(max_radius=100) {
    var r = user_randint(1, max_radius);
    var ans = Math.round((2 * Math.PI / 3) * Math.pow(r, 3) * 100) / 100;
    var problem = "Volume of hemisphere with radius " + r + " m = ";
    var solution = ans + " m^3";
    return [problem, solution];
}
function volume_pyramid(max_length=20, max_width=20, max_height=50, unit='m') {
    var length = user_randint(1, max_length);
    var width = user_randint(1, max_width);
    var height = user_randint(1, max_height);
    var ans = Math.round((length * width * height) / 3 * 100) / 100;
    var problem = "Volume of pyramid with base length = " + length + " " + unit + ", base width = " + width + " " + unit + " and height = " + height + " " + unit + " is";
    var solution = ans.toFixed(1) + " " + unit + "^3";
    return [problem, solution];
}
function volume_sphere(max_radius=100) {
    let r = user_randint(1, max_radius);
    let ans = Math.round((4 * Math.PI / 3) * Math.pow(r, 3) * 100) / 100;
    let problem = `Volume of sphere with radius ${r} m = `;
    let solution = `${ans} m^3`;
    return [problem, solution];
}
function perimeter_of_polygons(max_sides = 12, max_length = 120) {
    let size_of_sides = user_randint(3, max_sides);
    let sides = [];
    for (let i = 0; i < size_of_sides; i++) {
        sides.push(user_randint(1, max_length));
    }
    let tmp = sides.join(', ');
    let problem = `The perimeter of a ${size_of_sides} sided polygon with lengths of ${tmp}cm is: `;
    let solution = sides.reduce((a, b) => a + b, 0);
    return [problem, `${solution}`];
}
function assert_equal(a, b) {
    if (a !== b) {
        throw new Error("MyLogError MISMATCH");
    }
}
function test_1() {
    let tmp = absolute_difference();
    let a = tmp[0];
    let b = tmp[1];
    assert_equal(a, '&|-16-66|=&');
    assert_equal(b, '&82&');

    tmp = addition();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, '&15+14=&');
    assert_equal(b, '&29&');

    tmp = compare_fractions();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Which symbol represents the comparison between &\\frac{10}{1}& and &\\frac{5}{2}&?');
    assert_equal(b, '>');

    tmp = cube_root();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'What is the cube root of: &\\sqrt[3]{291}=& to 2 decimal places?');
    assert_equal(b, '&6.63&');

    tmp = divide_fractions();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, '&\\frac{4}{5}\\div\\frac{3}{6}=&');
    assert_equal(b, '&\\frac{8}{5}&');

    tmp = division();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, '&414\\div23=&');
    assert_equal(b, '&18&');

    tmp = exponentiation();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, '&7^{6}=&');
    assert_equal(b, '&117649&');

    tmp = factorial();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, '&6! =&');
    assert_equal(b, '&720&');

    tmp = fraction_multiplication();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, '&\\frac{5}{8}\\cdot\\frac{4}{8}=&');
    assert_equal(b, '&\\frac{5}{16}&');

    tmp = fraction_to_decimal();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, '&37\\div40=&');
    assert_equal(b, '&0.93&');

    tmp = greatest_common_divisor();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, '&GCD(351,207)=&');
    assert_equal(b, '&9&');

    tmp = is_composite();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Is &97& composite?');
    assert_equal(b, 'No');

    tmp = is_prime();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Is &92& prime?');
    assert_equal(b, 'No');

    tmp = multiplication();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, '&11\\cdot10=&');
    assert_equal(b, '&110&');

    tmp = percentage();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'What is &53&% of &62&?');
    assert_equal(b, '&32.86&');

    tmp = percentage_difference();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'What is the percentage difference between &93& and &96&?');
    assert_equal(b, '&3.17&%');

    tmp = percentage_error();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Find the percentage error when observed value equals &-37& and exact value equals &-91&.');
    assert_equal(b, '&59.34&%');

    tmp = power_of_powers();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Simplify &42^{3^{5}}&');
    assert_equal(b, '&42^{15}&');

    tmp = square();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, '&6^2=&');
    assert_equal(b, '&36&');

    tmp = square_root();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, '&\\sqrt{36}=&');
    assert_equal(b, '&6&');

    tmp = simplify_square_root();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, '&\\sqrt{20}&');
    assert_equal(b, '&2\\sqrt{5}&');

    tmp = subtraction();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, '&59-3=&');
    assert_equal(b, '&56&');
}
function test_2() {
    let tmp = bcd_to_decimal();
    let a = tmp[0];
    let b = tmp[1];
    assert_equal(a, 'Integer of Binary Coded Decimal &4 =& ');
    assert_equal(b, '&18304&');
    
    tmp = binary_2s_complement();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, "2^s complement of &1100000 = &");
    assert_equal(b, '&100000&');
    
    tmp = binary_complement_1s();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, '&01110 = &');
    assert_equal(b, '&10001&');

    tmp = binary_to_decimal();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, '&1100&');
    assert_equal(b, '&12&');

    tmp = binary_to_hex();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, '&1100&');
    assert_equal(b, '&0xc&');

    tmp = decimal_to_bcd();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'BCD of Decimal Number &4160 = &');
    assert_equal(b, '&1040&');

    tmp = decimal_to_binary();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Binary of &21 = &');
    assert_equal(b, '&10101&');

    tmp = decimal_to_hexadeci();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Hexadecimal of &384 = &');
    assert_equal(b, '&0x180&');

    tmp = decimal_to_octal();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'The decimal number &3762& in octal is: ');
    assert_equal(b, '&0o7262&');

    tmp = fibonacci_series();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'The Fibonacci Series of the first &18& numbers is ?');
    assert_equal(b, '&0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597&');

    tmp = modulo_division();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, '&77& % &52& = &');
    assert_equal(b, '&25&');

    tmp = nth_fibonacci_number();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'What is the 63th Fibonacci number?');
    assert_equal(b, '&6557470319842&');
}
function test_3() {
    let tmp = combinations();
    let a = tmp[0];
    let b = tmp[1];
    assert_equal(a, 'Find the number of combinations from &14& objects picked &8& at a time.');
    assert_equal(b, '&3003&');

    tmp = conditional_probability();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Someone tested positive for a nasty disease which only &0.61&% of the population have. Test sensitivity (true positive) is equal to &SN=99.29&% whereas test specificity (true negative) &SP=94.91&%. What is the probability that this guy really has that disease?');
    assert_equal(b, '&10.69&%');

    tmp = confidence_interval();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'The confidence interval for sample &[229, 231, 242, 225, 252, 290, 270, 227, 231, 258, 296, 243, 247, 232, 276, 272, 237, 240, 235, 220, 238, 292, 289]& with &80&% confidence is');
    assert_equal(b, '&(257.29, 244.62)&');

    tmp = data_summary();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Find the mean,standard deviation and variance for the data &40, 29, 33, 26, 26, 36, 7, 43, 16, 25, 17, 25, 28, 11, 13&');
    assert_equal(b, 'The Mean is &25.0&, Standard Deviation is &104.67&, Variance is &10.23&');

    tmp = dice_sum_probability();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'If &2& dice are rolled at the same time, the probability of getting a sum of &2 =&');
    assert_equal(b, '\\frac{1}{36}');

    tmp = mean_median();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Given the series of numbers &[2, 2, 11, 16, 19, 25, 26, 38, 46, 78]&. Find the arithmatic mean and median of the series');
    assert_equal(b, 'Arithmetic mean of the series is &26.3& and arithmetic median of this series is &22.0&');

    tmp = permutation();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Number of Permutations from &12& objects picked &8& at a time is: ');
    assert_equal(b, '&19958400&');
}
function test_4() {
    let tmp = angle_btw_vectors();
    let a = tmp[0];
    let b = tmp[1];
    assert_equal(a, 'angle between the vectors [829.89, 304.8, 293.49, 934.28, 906.11, 472.69, 173.37, 99.0, 290.11] and [311.65, 419.22, 249.45, 520.14, 899.08, 693.34, 270.07, 307.76, 578.14] is:');
    assert_equal(b, '0.49 radians');

    tmp = angle_regular_polygon();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Find the angle of a regular polygon with 20 sides');
    assert_equal(b, '162.0');

    tmp = arc_length();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Given radius, 22 and angle, 169. Find the arc length of the angle.');
    assert_equal(b, 'Arc length of the angle = 64.89134');

    tmp = area_of_circle();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Area of circle with radius 32=');
    assert_equal(b, '3216.99');

    tmp = area_of_circle_given_center_and_point();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Area of circle with center (5,-3) and passing through (9.32, 3.7300000000000004) is');
    assert_equal(b, '201.06');

    tmp = area_of_triangle();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Area of triangle with side lengths: 8, 5, 7 = ');
    assert_equal(b, '17.32');

    tmp = circumference();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Circumference of circle with radius 92 = ');
    assert_equal(b, '578.05');

    tmp = complementary_and_supplementary_angle();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'The complementary angle of 70 =');
    assert_equal(b, '20');

    tmp = curved_surface_area_cylinder();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'What is the curved surface area of a cylinder of radius, 26 and height, 62?');
    assert_equal(b, '10128.49');

    tmp = degree_to_rad();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Angle 167 degrees in radians is: ');
    assert_equal(b, '2.91');

    tmp = equation_of_line_from_two_points();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'What is the equation of the line between points (-1,-19) and (7,14) in slope-intercept form?');
    assert_equal(b, '8y = 33x -119');

    tmp = fourth_angle_of_quadrilateral();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Fourth angle of quadrilateral with angles 44 , 89, 56 =');
    assert_equal(b, '171');

    tmp = pythagorean_theorem();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'What is the hypotenuse of a right triangle given the other two sides have lengths 9 and 11?');
    assert_equal(b, '14.21');

    tmp = radian_to_deg();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Angle 0.93 radians in degrees is: ');
    assert_equal(b, '53.29');

    tmp = sector_area();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'What is the area of a sector with radius 10 and angle 214 degrees?');
    assert_equal(b, '186.75');

    tmp = sum_of_polygon_angles();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'What is the sum of interior angles of a polygon with 3 sides?');
    assert_equal(b, '180');

    tmp = surface_area_cone();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Surface area of cone with height = 6m and radius = 1m is');
    assert_equal(b, '22 m^2');

    tmp = surface_area_cube();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Surface area of cube with side = 6m is');
    assert_equal(b, '216 m^2');

    tmp = surface_area_cuboid();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Surface area of cuboid with sides of lengths: 4m, 4m, 1m is');
    assert_equal(b, '48 m^2');

    tmp = surface_area_cylinder();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Surface area of cylinder with height = 24m and radius = 16m is');
    assert_equal(b, '4021 m^2');

    tmp = surface_area_pyramid();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Surface area of pyramid with base length = 40m, base width = 32m, and height = 12m is');
    assert_equal(b, '2560 m^2');

    tmp = surface_area_sphere();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Surface area of a sphere with radius = 2m is');
    assert_equal(b, '50.27 m^2');

    tmp = third_angle_of_triangle();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Third angle of triangle with angles 21 and 26 = ');
    assert_equal(b, '133');

    tmp = valid_triangle();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Does triangle with sides 32, 39 and 50 exist?');
    assert_equal(b, 'yes');

    tmp = volume_cone();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Volume of cone with height = 25m and radius = 11m is');
    assert_equal(b, '3167 m^3');

    tmp = volume_cube();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Volume of cube with a side length of 12m is');
    assert_equal(b, '1728 m^3');

    tmp = volume_cuboid();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Volume of cuboid with sides = 19m, 20m, 20m is');
    assert_equal(b, '7600 m^3');

    tmp = volume_cylinder();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Volume of cylinder with height = 33m and radius = 5m is');
    assert_equal(b, '2591 m^3');

    tmp = volume_cone_frustum();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Volume of frustum with height = 30m and r1 = 6m is and r2 = 7m is ');
    assert_equal(b, '3989.82 m^3');

    tmp = volume_hemisphere();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Volume of hemisphere with radius 65 m = ');
    assert_equal(b, '575173.25 m^3');

    tmp = volume_pyramid();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Volume of pyramid with base length = 15 m, base width = 6 m and height = 36 m is');
    assert_equal(b, '1080.0 m^3');

    tmp = volume_sphere();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'Volume of sphere with radius 27 m = ');
    assert_equal(b, '82447.96 m^3');

    tmp = perimeter_of_polygons();
    a = tmp[0];
    b = tmp[1];
    assert_equal(a, 'The perimeter of a 10 sided polygon with lengths of 66, 97, 50, 14, 62, 52, 107, 82, 58, 101cm is: ');
    assert_equal(b, '689');
}
function test() {
    test_1();
    user_reset_seed();
    test_2();
    user_reset_seed();
    test_3();
    user_reset_seed();
    test_4();
    user_reset_seed();
    additional_tests();
}
function assert_iter_equal(a, b) {
    a.forEach((element, index) => {
        assert_equal(element, b[index]);
    });

    return true;
}
function additional_tests() {
    let tmp = addition(10, 20);
    assert_iter_equal(tmp, ['&4+5=&', '&9&']);
    for (let i = 0; i < 4; i++) {
        tmp = compare_fractions(2);
    }
    assert_iter_equal(tmp, ['Which symbol represents the comparison between &\\frac{1}{2}& and &\\frac{1}{2}&?', '=']);
    for (let i = 0; i < 3; i++) {
        tmp = divide_fractions(2);
    }
    assert_iter_equal(tmp, ['&\\frac{2}{1}\\div\\frac{1}{2}=&', '&\\frac{4}{1}&']);

    for (let i = 0; i < 5; i++) {
        tmp = fraction_multiplication(2);
    }
    assert_iter_equal(tmp, ['&\\frac{2}{1}\\cdot\\frac{2}{1}=&', '&\\frac{4}{1}&']);
    
    tmp = is_composite(4);
    assert_iter_equal(tmp, ['Is &4& composite?', 'Yes']);

    tmp = is_prime(2);
    assert_iter_equal(tmp, ['Is &2& prime?', 'Yes']);

    tmp = is_prime(3);
    assert_iter_equal(tmp, ['Is &3& prime?', 'Yes']);

    for (let i = 0; i < 4; i++) {
        tmp = is_prime(36);
    }
    assert_iter_equal(tmp, ['Is &11& prime?', 'Yes']);

    tmp = dice_sum_probability(1);
    assert_iter_equal(tmp, ['If &1& dice are rolled at the same time, the probability of getting a sum of &1 =&', '\\frac{1}{6}']);

    for (let i = 0; i < 4; i++) {
        tmp = dice_sum_probability(3);
    }
    assert_iter_equal(tmp, ['If &3& dice are rolled at the same time, the probability of getting a sum of &9 =&', '\\frac{25}{216}']);

    tmp = complementary_and_supplementary_angle(2, 3);
    tmp = complementary_and_supplementary_angle(2, 4);
    tmp = complementary_and_supplementary_angle(2, 5);
    tmp = complementary_and_supplementary_angle(2, 6);
    assert_iter_equal(tmp, ['The supplementary angle of 2 =', '178']);

    tmp = equation_of_line_from_two_points(3, 2);
    tmp = equation_of_line_from_two_points(4, 2);
    tmp = equation_of_line_from_two_points(6, 6);
    tmp = equation_of_line_from_two_points(8, 2);
    tmp = equation_of_line_from_two_points(10, 2);
    tmp = equation_of_line_from_two_points(16, 4);
    tmp = equation_of_line_from_two_points(36, 4);
    assert_iter_equal(tmp, ['What is the equation of the line between points (5,34) and (7,4) in slope-intercept form?', 'y = -15x + 109']);

    for (let i = 0; i < 15; i++) {
        tmp = equation_of_line_from_two_points(1, 0);
    }
    assert_iter_equal(tmp, ['What is the equation of the line between points (0,1) and (1,1) in slope-intercept form?', 'y = 1']);

    tmp = is_composite(0);
    assert_iter_equal(tmp, ['Is &1& composite?', 'No']);
}

// Global Begin
test();