class EmployeeSerializer
  def initialize(employee, salary_record: nil, include_history: false)
    @employee = employee
    @salary_record = salary_record
    @include_history = include_history
  end

  def as_json(*_args)
    payload = {
      id: @employee.id,
      employee_number: @employee.employee_number,
      first_name: @employee.first_name,
      last_name: @employee.last_name,
      full_name: "#{@employee.first_name} #{@employee.last_name}",
      email: @employee.email,
      country_code: @employee.country.code,
      department: @employee.department.name,
      job_title: @employee.job_title,
      status: @employee.status,
      hired_on: @employee.hired_on,
      current_salary: SalarySerializer.new(@salary_record).as_json
    }
    payload[:salary_history] = @employee.salary_records.map { |record| SalarySerializer.new(record).as_json } if @include_history
    payload
  end
end
