class EmployeeCreator
  def initialize(organization:, employee_attributes:, initial_salary_attributes: nil)
    @organization = organization
    @employee_attributes = employee_attributes
    @initial_salary_attributes = initial_salary_attributes
  end

  def call
    attributes = @employee_attributes.to_h.symbolize_keys
    country_code = attributes.delete(:country_code)
    department_name = attributes.delete(:department)
    employee = @organization.employees.build(attributes)
    employee.country = Country.find_by(code: country_code)
    employee.department = @organization.departments.find_by(name: department_name)
    employee.errors.add(:country_code, "is invalid") unless employee.country
    employee.errors.add(:department, "is not configured for this organization") unless employee.department
    initial_salary = employee.salary_records.build(@initial_salary_attributes) if @initial_salary_attributes.present?
    success = false

    Employee.transaction do
      if employee.errors.empty? && employee.save && (initial_salary.nil? || initial_salary.save)
        success = true
      else
        initial_salary&.errors&.each { |error| employee.errors.add(:base, error.full_message) }
        raise ActiveRecord::Rollback
      end
    end

    ServiceResult.new(value: employee, success:)
  end
end
