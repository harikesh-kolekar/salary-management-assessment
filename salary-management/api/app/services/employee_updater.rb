class EmployeeUpdater
  def initialize(id:, attributes:)
    @id = id
    @attributes = attributes
  end

  def call
    employee = Employee.find(@id)
    ServiceResult.new(value: employee, success: employee.update(@attributes))
  end
end
