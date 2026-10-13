require "test_helper"

class EmployeeDirectoryTest < ActiveSupport::TestCase
  test "preloads country and department for every directory employee" do
    organization = Organization.create!(name: "Directory Test", slug: "directory-test")
    user = organization.users.create!(
      full_name: "Directory Manager",
      email: "directory-manager@example.test",
      password_salt: "directory-manager-salt",
      password_digest: User.digest_password("testing-password", "directory-manager-salt")
    )
    departments = %w[Engineering Finance].map do |name|
      organization.departments.create!(name:, hr_manager: user)
    end
    country = Country.find_by!(code: "US")

    3.times do |index|
      organization.employees.create!(
        employee_number: "DIRECTORY-%03d" % index,
        first_name: "Directory",
        last_name: "Employee #{index}",
        email: "directory-#{index}@example.test",
        country:,
        department: departments[index % departments.length],
        job_title: "Analyst",
        status: "active",
        hired_on: Date.new(2024, 1, 1)
      )
    end

    result = Employees::EmployeeDirectory.new(organization:, filters: {}).call

    assert_equal 3, result.employees.length
    result.employees.each do |employee, _salary|
      assert_predicate employee.association(:country), :loaded?
      assert_predicate employee.association(:department), :loaded?
    end
  end
end
