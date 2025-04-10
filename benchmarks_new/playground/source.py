
### You can have classes in your code
class student_base:
    ### Your call can only have member functions. Member variables are NOT allowed.
    def __init__(self, name, age):
        self.name = name
        self.age = age
        self.count = 0
    
    def get_name(self):
        return self.name

    def get_age(self):
        return self.age

### You can have inheritance in your code. But only single inheritance is supported.
class student(student_base):
    def __init__(self, name, age, uid, income): ### Your code should init the super class like this
        super().__init__(name, age)
        self.uid = uid
        self.income = income

    def get_uid(self):
        return self.uid
    
    def get_income(self):
        return self.income
    
    ### You can have operator overloading in your code. But we only support `==` (`__eq__`) operator overloading currently.
    def __eq__(self, value):
        if isinstance(value, student): ### You can use `isinstance` to check the type of an object
            return self.get_uid() == value.get_uid()
        return False

def get_helper_function():
    
    def compute_avg_salary(salaries): ### Your code can have nested functions. But make sure to put them in the beginning of the parent scope
        total_salary = 0
        for s in salaries:
            total_salary += s
        return total_salary / len(salaries)

    def compute_avg_age(ages): ### Your code can have nested functions. But make sure to put them in the beginning of the parent scope
        total_age = 0
        for a in ages:
            total_age += a
        return total_age / len(ages)
    
    ### Your code can have high-order values.
    return compute_avg_salary, compute_avg_age


### You can have functions in your code
def test_helper():
    
    compute_avg_salary, compute_avg_age = get_helper_function()
    
    u_1 = student("Alice", 20, 1, 1000)
    u_2 = student("Bob", 30, 2, 2000)
    u_3 = student("Charlie", 40, 3, 3000)
    u_4 = student("David", 30, 4, 4000)
    
    users = [u_1, u_2, u_3, u_4]
    salaries = [u.get_income() for u in users] ### Comprenhension is supported
    ages = [u.get_age() for u in users]

    avg_salary = compute_avg_salary(salaries)
    if PRINT_RESULT:
        print(avg_salary)
    assert avg_salary == 2500
    avg_age = compute_avg_age(ages)
    if PRINT_RESULT:
        print(avg_age)
    assert avg_age == 30
    
    u_5 = student("Alice", 60, 5, 5000)
    assert u_1 != u_5 ### Your code can use operator overloadings
    assert u_1.get_name() == u_5.get_name()

    
def test():
    test_helper()
    print("All tests passed!")

# Your code should use the below "global signature" to specify where the global scope statrs.

### Global Begin

# All the variables declarations, expressions, statments that belong to the global scope should be put after the "global signature"
PRINT_RESULT = True # your code can have global variables
test()
