class SalaryRecordCreator
  def initialize(organization:, employee_id:, attributes:)
    @organization = organization
    @employee_id = employee_id
    @attributes = attributes
  end

  def call
    record = @organization.employees.find(@employee_id).salary_records.build(@attributes)
    ServiceResult.new(value: record, success: record.save)
  end
end
