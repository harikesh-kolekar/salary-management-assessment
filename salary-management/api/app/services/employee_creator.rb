class EmployeeCreator
  Result = Struct.new(:employee, :success, keyword_init: true) do
    def success?
      success
    end
  end

  def initialize(employee_attributes:, initial_salary_attributes: nil)
    @employee_attributes = employee_attributes
    @initial_salary_attributes = initial_salary_attributes
  end

  def call
    employee = Employee.new(@employee_attributes)
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

    Result.new(employee:, success:)
  end
end
