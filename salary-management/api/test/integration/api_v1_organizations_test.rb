require "test_helper"

class ApiV1OrganizationsTest < ActionDispatch::IntegrationTest
  test "organization registration creates its manager and returns a login token" do
    assert_difference(["Organization.count", "User.count"], 1) do
      post api_v1_organizations_path, params: {
        organization: {
          name: "Northwind Legal",
          manager_name: "Jordan Lee",
          email: "jordan@northwind.test",
          password: "northwind-pass-123",
          password_confirmation: "northwind-pass-123"
        }
      }, as: :json
    end

    assert_response :created
    assert_equal "Northwind Legal", response.parsed_body.dig("user", "organization", "name")
    assert_equal "admin", response.parsed_body.dig("user", "role")
    assert_equal Department::DEFAULT_NAMES.length, Organization.find_by!(slug: "northwind-legal").departments.count
    assert response.parsed_body["token"].present?
  end

  test "manager can log in and retrieve the current session" do
    post api_v1_session_path, params: { email: @test_user.email, password: "testing-password" }, as: :json

    assert_response :success
    token = response.parsed_body.fetch("token")
    assert_equal @test_user.id, response.parsed_body.dig("user", "id")

    get api_v1_session_path, headers: { "Authorization" => "Bearer #{token}" }

    assert_response :success
    assert_equal @test_organization.id, response.parsed_body.dig("user", "organization", "id")
  end

  test "manager login does not accept an incorrect password" do
    post api_v1_session_path, params: { email: @test_user.email, password: "incorrect-password" }, as: :json

    assert_response :unauthorized
    assert_equal "Invalid email or password", response.parsed_body["error"]
  end

  test "an organization can have only one admin user" do
    duplicate = @test_organization.users.build(full_name: "Second Admin", email: "second-admin@example.test", role: "admin", password_salt: "other-salt", password_digest: User.digest_password("testing-password", "other-salt"))

    assert_not duplicate.valid?
    assert_includes duplicate.errors[:role], "is limited to one admin per organization"
  end

  test "admin can add an HR manager and department, and reassign departments" do
    post api_v1_hr_managers_path, params: {
      hr_manager: { full_name: "Taylor HR", email: "taylor.hr@example.test", password: "testing-password", password_confirmation: "testing-password" }
    }, as: :json

    assert_response :created
    manager_id = response.parsed_body.dig("data", "id")
    assert_equal "hr_manager", response.parsed_body.dig("data", "role")

    post api_v1_departments_path, params: { department: { name: "Compliance", hr_manager_id: manager_id } }, as: :json

    assert_response :created
    department_id = response.parsed_body.dig("data", "id")
    assert_equal "COMPLIANCE", response.parsed_body.dig("data", "code")
    assert_equal manager_id, response.parsed_body.dig("data", "hr_manager", "id")

    patch api_v1_department_path(@test_organization.departments.find_by!(name: "Legal")), params: { department: { hr_manager_id: manager_id } }, as: :json

    assert_response :success
    assert_equal manager_id, response.parsed_body.dig("data", "hr_manager", "id")
    assert_equal manager_id, Department.find(department_id).hr_manager_id

    patch api_v1_department_path(department_id), params: { department: { name: "Legal Services" } }, as: :json

    assert_response :success
    assert_equal "Legal Services", response.parsed_body.dig("data", "name")
    assert_equal manager_id, response.parsed_body.dig("data", "hr_manager", "id")
  end

  test "admin endpoints cannot assign users from another organization" do
    other = Organization.create!(name: "Outside Org", slug: "outside-org")
    outside_manager = other.users.create!(
      full_name: "Outside HR", email: "outside-hr@example.test", role: "hr_manager",
      password_salt: "outside-manager-salt", password_digest: User.digest_password("testing-password", "outside-manager-salt")
    )

    post api_v1_departments_path, params: { department: { name: "Restricted", hr_manager_id: outside_manager.id } }, as: :json

    assert_response :unprocessable_entity
    assert_not @test_organization.departments.exists?(name: "Restricted")

    outside_department = other.departments.create!(name: "Outside Legal", hr_manager: outside_manager)
    patch api_v1_department_path(outside_department), params: { department: { name: "Hijacked" } }, as: :json

    assert_response :not_found
    assert_equal "Outside Legal", outside_department.reload.name
  end

  test "HR managers cannot create users or departments" do
    hr_manager = @test_organization.users.create!(
      full_name: "Limited HR", email: "limited-hr@example.test", role: "hr_manager",
      password_salt: "limited-hr-salt", password_digest: User.digest_password("testing-password", "limited-hr-salt")
    )
    Thread.current[:salary_management_test_token] = SessionToken.issue(hr_manager)

    post api_v1_hr_managers_path, params: { hr_manager: { full_name: "Another HR", email: "another-hr@example.test", password: "testing-password", password_confirmation: "testing-password" } }, as: :json
    assert_response :forbidden

    post api_v1_departments_path, params: { department: { name: "Unauthorized" } }, as: :json
    assert_response :forbidden
  end

  test "organization data endpoints require authentication" do
    Thread.current[:salary_management_test_token] = nil

    get api_v1_employees_path

    assert_response :unauthorized
  end

  test "manager cannot list or view another organization's employees" do
    other_organization = Organization.create!(name: "Other Org", slug: "other-org")
    other_manager = other_organization.users.create!(full_name: "Other HR", email: "hr@other.test", password_salt: "other-test-salt", password_digest: User.digest_password("testing-password", "other-test-salt"))
    other_department = other_organization.departments.create!(name: "Legal", hr_manager: other_manager)
    other_employee = other_organization.employees.create!(
      employee_number: "OTHER-1", first_name: "Alex", last_name: "Kim",
      email: "alex@other.test", country: Country.find_by!(code: "US"), department: other_department,
      job_title: "Counsel", status: "active", hired_on: Date.current
    )
    other_employee.salary_records.create!(amount: 100_000, currency: "USD", effective_from: Date.current, reason: "Initial")

    get api_v1_employees_path, params: { q: "OTHER-1" }

    assert_response :success
    assert_equal 0, response.parsed_body.dig("meta", "total")

    get api_v1_employee_path(other_employee)

    assert_response :not_found

    patch api_v1_employee_path(other_employee), params: { employee: { department: "Finance" } }, as: :json

    assert_response :not_found

    post api_v1_employee_salary_records_path(other_employee), params: {
      salary_record: { amount: 120_000, currency: "USD", effective_from: Date.current + 1, reason: "Raise" }
    }, as: :json

    assert_response :not_found

    get api_v1_dashboard_path

    assert_response :success
    assert_equal 0, response.parsed_body["employee_count"]
  end
end
