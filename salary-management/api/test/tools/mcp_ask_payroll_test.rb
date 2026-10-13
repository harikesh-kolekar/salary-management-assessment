require "test_helper"

class McpAskPayrollTest < ActionDispatch::IntegrationTest
  test "visible employee scope includes only departments assigned to an HR manager" do
    hr_manager = @test_organization.users.create!(
      full_name: "Scoped HR",
      email: "scoped-hr@example.test",
      role: "hr_manager",
      password_salt: "scoped-hr-salt",
      password_digest: User.digest_password("testing-password", "scoped-hr-salt")
    )
    engineering = @test_organization.departments.find_by!(name: "Engineering")
    engineering.update!(hr_manager: hr_manager)
    finance = @test_organization.departments.find_by!(name: "Finance")
    allowed_employee = create_employee("MCP-ENG-1", engineering)
    denied_employee = create_employee("MCP-FIN-1", finance)
    other_organization = Organization.create!(name: "Other MCP Org", slug: "other-mcp-org")
    other_manager = other_organization.users.create!(
      full_name: "Other Manager",
      email: "other-mcp-manager@example.test",
      password_salt: "other-mcp-manager-salt",
      password_digest: User.digest_password("testing-password", "other-mcp-manager-salt")
    )
    other_department = other_organization.departments.create!(name: "Engineering", hr_manager: other_manager)
    other_employee = other_organization.employees.create!(
      employee_number: "OTHER-MCP-1",
      first_name: "Other",
      last_name: "Tenant",
      email: "other-mcp-employee@example.test",
      country: Country.find_by!(code: "US"),
      department: other_department,
      job_title: "Analyst",
      status: "active",
      hired_on: Date.new(2024, 1, 1)
    )
    visible_ids = Employees::VisibleScope.for(hr_manager).pluck(:id)

    assert_equal [allowed_employee.id], visible_ids
    assert_not_includes visible_ids, denied_employee.id
    assert_not_includes visible_ids, other_employee.id
  end

  test "MCP payroll tool uses the authenticated server context" do
    response = PayrollMcpTool.call(
      question: "Tell me a joke",
      server_context: { user_id: @test_user.id }
    )

    assert_equal Reports::PayrollAssistant::OUT_OF_SCOPE_REPLY, response.structured_content.fetch(:answer)
    assert_nil response.structured_content.fetch(:report)
  end

  private

  def create_employee(number, department)
    @test_organization.employees.create!(
      employee_number: number,
      first_name: "MCP",
      last_name: number,
      email: "#{number.downcase}@example.test",
      country: Country.find_by!(code: "US"),
      department:,
      job_title: "Analyst",
      status: "active",
      hired_on: Date.new(2024, 1, 1)
    )
  end
end
