require "test_helper"

class EmployeeCreatorTest < ActiveSupport::TestCase
  test "creates the employee and initial salary as one operation" do
    assert_difference(["Employee.count", "SalaryRecord.count"], 1) do
      @result = Employees::EmployeeCreator.new(
        organization: test_organization,
        employee_attributes: employee_attributes,
        initial_salary_attributes: {
          amount: 90_000,
          currency: "USD",
          effective_from: Date.current,
          reason: "Initial compensation"
        }
      ).call
    end

    assert @result.success?
    assert_equal 90_000, @result.value.current_salary_record.amount
  end

  test "rolls back employee creation when initial salary is invalid" do
    assert_no_difference(["Employee.count", "SalaryRecord.count"]) do
      @result = Employees::EmployeeCreator.new(
        organization: test_organization,
        employee_attributes: employee_attributes,
        initial_salary_attributes: {
          amount: 0,
          currency: "USD",
          effective_from: Date.current,
          reason: "Initial compensation"
        }
      ).call
    end

    assert_not @result.success?
    assert_predicate @result.value.errors, :any?
  end

  private

  def employee_attributes
    {
      employee_number: "ACME-SERVICE-1",
      first_name: "Jordan",
      last_name: "Lee",
      email: "jordan.lee@example.test",
      country_code: "US",
      department: "Finance",
      job_title: "Analyst",
      status: "active",
      hired_on: Date.current
    }
  end

  def test_organization
    return @test_organization if @test_organization

    @test_organization = Organization.create!(name: "Service Test Org", slug: "service-test-org")
    salt = "service-test-salt"
    manager = @test_organization.users.create!(full_name: "Service HR", email: "service-hr@example.test", password_salt: salt, password_digest: User.digest_password("testing-password", salt))
    Department::DEFAULT_NAMES.each { |name| @test_organization.departments.create!(name:, hr_manager: manager) }
    @test_organization
  end
end
