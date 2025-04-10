
DEBUG = True ### Wrong way to organize the code structure !!! Your code should use the "### Global Begin" comment to specify where the global scope statrs. And every thing belongs to the global scope should be put after the "global comment".
### And pay special attention to variable names. Some string is left for js key words like "const", etc. If your code use variable names like "const", "let", "var", etc., please change them to other names.
### And variable names like "DEBUG" may conflict with our translation tool. Please change them to other names.

class student_base(object): ### Has not been supported yet !!! Your code should not inherit from built-in classes!!
    count = 0 ### Has not been supported yet !!! Member variables are NOT allowed.    
    def __init__(self, name, age):
        self.name = name
        self.age = age
    
    def get_name(self):
        return self.name

    def get_age(self):
        return self.age


class student(student_base):
    def __init__(self, name, age, uid, income):
        
        new_age = age + 1
        self.uid = uid
        self.income = income
        super().__init__(name, new_age) ### Has not been supported yet !!! Super Init should only use the arguments of the __init__ function.

    def get_uid(self):
        return self.uid
    
    def get_income(self):
        return self.income
    
    def __str__(self): ### Has not been supported yet !!! Overload the `__str__` has not been supported yet.
        return "User: " + self.name + ", " + str(self.age) + ", " + str(self.uid) + ", " + str(self.income)
    
    def __eq__(self, value):
        if isinstance(value, student):
            return self.uid == value.uid
        return False

def get_users(): ### Not recommended !!! Generator function has not been well supported yet.
    yield student("Alice", 20, 1, 1000)
    yield student("Bob", 30, 2, 2000)
    yield student("Charlie", 40, 3, 3000)
    yield student("David", 50, 4, 4000)

def get_helper_function(x, y=1, *args, **kw): ### Default arguments and argument splitters have not been supported yet!
    some_variable = "some value"
    another_variable = "another value"

    ### Wrong way to organize the code structure !!! You should move the nested functions declaration to the beginning of the parent scope.
    def compute_avg_salary(salaries):
        total_salary = 0
        for s in salaries:
            total_salary += s
        return total_salary / len(salaries)

    ### Wrong way to organize the code structure !!! You should move the nested functions declaration to the beginning of the parent scope.
    def compute_avg_age(ages):
        total_age = 0
        for a in ages:
            total_age += a
        return total_age / len(ages)
    
    return compute_avg_salary, compute_avg_age

def test_helper():
    users = [u for u in get_users()]
    salaries = [u.get_income() for u in users]
    ages = [u.get_age() for u in users]

    compute_avg_salary, compute_avg_age = get_helper_function(None)
    
    avg_salary = compute_avg_salary(salaries)
    if DEBUG:
        print(avg_salary)
    assert avg_salary == 2500
    avg_age = compute_avg_age(ages)
    if DEBUG:
        print(avg_age)
    assert avg_age == 36
    
    u_5 = student("Eve", 60, 1, 5000)
    assert users[0] == u_5
    
def test():
    test_helper()
    print("All tests passed!")

### !!! Miss the "### Global Begin" signature.

test()
