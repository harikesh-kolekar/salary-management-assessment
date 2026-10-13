module Employees
  class VisibleScope
    def self.for(user)
      employees = user.organization.employees
      return employees unless user.hr_manager?

      employees.where(department_id: user.managed_departments.select(:id))
    end
  end
end
