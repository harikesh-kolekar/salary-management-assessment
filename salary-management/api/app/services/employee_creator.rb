class EmployeeCreator
  def initialize(organization:, employee_attributes:, initial_salary_attributes: nil)
    @organization = organization
    @employee_attributes = employee_attributes
    @initial_salary_attributes = initial_salary_attributes
  end

  def call
    employee = @organization.employees.build(@employee_attributes)
    initial_salary = employee.salary_records.build(@initial_salary_attributes) if @initial_salary_attributes.present?
    success = false

    Employee.transaction do
      if employee.save && (initial_salary.nil? || initial_salary.save)
        success = true
      else
        initial_salary&.errors&.each { |error| employee.errors.add(:base, error.full_message) }
        raise ActiveRecord::Rollback
      end
    end

    ServiceResult.new(value: employee, success:)
  end
end
