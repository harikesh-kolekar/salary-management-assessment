class EmployeeUpdater
  Result = Struct.new(:employee, :success, keyword_init: true) do
    def success?
      success
    end
  end

  def initialize(id:, attributes:)
    @id = id
    @attributes = attributes
  end

  def call
    employee = Employee.find(@id)
    Result.new(employee:, success: employee.update(@attributes))
  end
end
