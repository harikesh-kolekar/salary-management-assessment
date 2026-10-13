require "test_helper"

class EmployeeTest < ActiveSupport::TestCase
  test "cannot reference a department from another organization" do
    organization = Organization.create!(name: "Employee Org", slug: "employee-org")
    manager = create_manager(organization, "employee-manager@example.test")
    organization.departments.create!(name: "Engineering", hr_manager: manager)

    other_organization = Organization.create!(name: "Other Employee Org", slug: "other-employee-org")
    other_manager = create_manager(other_organization, "other-employee-manager@example.test")
    foreign_department = other_organization.departments.create!(name: "Legal", hr_manager: other_manager)

    employee = organization.employees.build(
      employee_number: "TENANT-BOUNDARY-1", first_name: "Alex", last_name: "Morgan",
      email: "alex.morgan@example.test", country: Country.find_by!(code: "US"),
      department: foreign_department, job_title: "Counsel", status: "active", hired_on: Date.current
    )

    assert_not employee.valid?
    assert_includes employee.errors[:department], "must belong to the same organization"
  end

  private

  def create_manager(organization, email)
    salt = "employee-test-salt-#{email}"
    organization.users.create!(
      full_name: "Test Manager", email:, password_salt: salt,
      password_digest: User.digest_password("testing-password", salt)
    )
  end
end
