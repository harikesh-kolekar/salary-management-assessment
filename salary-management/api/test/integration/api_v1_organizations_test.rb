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
    assert_equal "manager", response.parsed_body.dig("user", "role")
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

  test "organization data endpoints require authentication" do
    Thread.current[:salary_management_test_token] = nil

    get api_v1_employees_path

    assert_response :unauthorized
  end

  test "manager cannot list or view another organization's employees" do
    other_organization = Organization.create!(name: "Other Org", slug: "other-org")
    other_employee = other_organization.employees.create!(
      employee_number: "OTHER-1", first_name: "Alex", last_name: "Kim",
      email: "alex@other.test", country_code: "US", department: "Legal",
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
