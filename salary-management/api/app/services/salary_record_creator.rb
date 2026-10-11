class SalaryRecordCreator
  def initialize(employee_id:, attributes:)
    @employee_id = employee_id
    @attributes = attributes
  end

  def call
    record = Employee.find(@employee_id).salary_records.build(@attributes)
    ServiceResult.new(value: record, success: record.save)
  end
end
