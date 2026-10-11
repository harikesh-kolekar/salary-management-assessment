class SalaryRecordCreator
  Result = Struct.new(:record, :success, keyword_init: true) do
    def success?
      success
    end
  end

  def initialize(employee_id:, attributes:)
    @employee_id = employee_id
    @attributes = attributes
  end

  def call
    record = Employee.find(@employee_id).salary_records.build(@attributes)
    Result.new(record:, success: record.save)
  end
end
