class EmployeeUpdater
  def initialize(organization:, id:, attributes:)
    @organization = organization
    @id = id
    @attributes = attributes
  end

  def call
    employee = @organization.employees.find(@id)
    ServiceResult.new(value: employee, success: employee.update(@attributes))
  end
end
