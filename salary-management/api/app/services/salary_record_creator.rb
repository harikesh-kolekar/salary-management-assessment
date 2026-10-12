class SalaryRecordCreator
  def initialize(organization:, employee_id:, attributes:, employee_scope: nil)
    @organization = organization
    @employee_scope = employee_scope || organization.employees
    @employee_id = employee_id
    @attributes = attributes
  end

  def call
    record = @employee_scope.find(@employee_id).salary_records.build(@attributes)
    ServiceResult.new(value: record, success: record.save)
  end
end
