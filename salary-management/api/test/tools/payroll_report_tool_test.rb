require "test_helper"

class PayrollReportToolTest < ActiveSupport::TestCase
  setup do
    @organization = Organization.create!(name: "Payroll Report Test", slug: "payroll-report-test")
    salt = "payroll-report-test-salt"
    manager = @organization.users.create!(
      full_name: "Report Manager",
      email: "report-manager@example.test",
      password_salt: salt,
      password_digest: User.digest_password("test-password", salt)
    )
    @engineering = @organization.departments.create!(name: "Engineering", hr_manager: manager)
    @finance = @organization.departments.create!(name: "Finance", hr_manager: manager)
    @country = Country.find_by!(code: "US")
    @engineer = create_employee("REPORT-ENG-1", "Avery", @engineering)
    create_employee("REPORT-ENG-2", "Morgan", @engineering)
    create_employee("REPORT-FIN-1", "Riley", @finance)
  end

  test "aggregate pie reports omit employee rows and respect the supplied visible scope" do
    visible_scope = @organization.employees.where(id: @engineer.id)
    tool = PayrollReportTool.new(employee_scope: visible_scope, include_rows_override: false)

    tool.execute(
      report_type: "headcount", after_date: "", department: "", country_code: "", status: "all",
      group_by: "department", chart_type: "pie", include_rows: true, include_chart: true, page: 1
    )

    report = tool.result
    assert_equal 1, report[:total]
    assert_equal "pie", report[:chart_type]
    assert_equal "department", report[:chart_group]
    assert_equal false, report[:show_table]
    assert_empty report[:rows]
    assert_equal [{ label: "Engineering", value: 1 }], report[:chart]
  end

  test "employee list reports include only the requested paginated rows" do
    tool = PayrollReportTool.new(employee_scope: @organization.employees, include_rows_override: true)

    tool.execute(
      report_type: "employees", after_date: "", department: "Finance", country_code: "", status: "all",
      group_by: "none", chart_type: "bar", include_rows: false, include_chart: false, page: 1
    )

    report = tool.result
    assert_equal 1, report[:total]
    assert_equal true, report[:show_table]
    assert_equal ["Riley Test"], report[:rows].map { |row| row[:employee] }
    assert_empty report[:chart]
  end

  private

  def create_employee(number, first_name, department)
    @organization.employees.create!(
      employee_number: number,
      first_name:,
      last_name: "Test",
      email: "#{number.downcase}@example.test",
      country: @country,
      department:,
      job_title: "Analyst",
      status: "active",
      hired_on: Date.new(2024, 1, 1)
    )
  end
end
