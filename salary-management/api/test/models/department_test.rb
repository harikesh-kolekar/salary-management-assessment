require "test_helper"

class DepartmentTest < ActiveSupport::TestCase
  setup do
    @organization = Organization.create!(name: "Department Test Org", slug: "department-test-org")
    @manager = create_user(@organization, "manager@department.test")
  end

  test "requires one HR manager and derives a stable code from the name" do
    department = @organization.departments.build(name: "Client Services", hr_manager: @manager)

    assert department.valid?
    assert_equal "CLIENT_SERVICES", department.code

    unassigned = @organization.departments.build(name: "Unassigned")
    assert_not unassigned.valid?
    assert_includes unassigned.errors.attribute_names, :hr_manager
  end

  test "HR manager must belong to the department organization" do
    other_org = Organization.create!(name: "Other Department Org", slug: "other-department-org")
    other_manager = create_user(other_org, "manager@other-department.test")
    department = @organization.departments.build(name: "Legal", hr_manager: other_manager)

    assert_not department.valid?
    assert_includes department.errors[:hr_manager], "must belong to the same organization"
  end

  private

  def create_user(organization, email)
    salt = "department-test-salt-#{email}"
    organization.users.create!(
      full_name: "Department Manager", email:, password_salt: salt,
      password_digest: User.digest_password("testing-password", salt)
    )
  end
end
