require "test_helper"

class ApiV1EmployeesTest < ActionDispatch::IntegrationTest
  setup do
    @employee = Employee.create!(
      employee_number: "ACME-TEST-1", first_name: "Maya", last_name: "Chen",
      email: "maya.chen@example.test", country_code: "US", department: "Engineering",
      job_title: "Staff Engineer", status: "active", hired_on: Date.new(2020, 3, 1)
    )
    @salary = @employee.salary_records.create!(amount: 150_000, currency: "USD", effective_from: Date.new(2025, 1, 1), reason: "Annual review")
  end

  test "directory searches and paginates employee records" do
    get api_v1_employees_path, params: { q: "maya", per_page: 1 }

    assert_response :success
    payload = response.parsed_body
    assert_equal 1, payload.dig("meta", "total")
    assert_equal "ACME-TEST-1", payload.dig("data", 0, "employee_number")
    assert_equal 150_000.0, payload.dig("data", 0, "current_salary", "amount")
  end

  test "employee profile includes salary history and current salary" do
    get api_v1_employee_path(@employee)

    assert_response :success
    assert_equal @salary.id, response.parsed_body.dig("data", "current_salary", "id")
    assert_equal 1, response.parsed_body.dig("data", "salary_history").length
  end

  test "new salary is appended and becomes the current salary on its effective date" do
    post api_v1_employee_salary_records_path(@employee), params: {
      salary_record: { amount: "165000", currency: "USD", effective_from: "2026-06-01", reason: "Promotion" }
    }, as: :json

    assert_response :created
    assert_equal 165_000.0, response.parsed_body.dig("data", "amount")
    assert_equal 2, @employee.salary_records.count
  end

  test "salary change rejects a repeated effective date and invalid currency" do
    post api_v1_employee_salary_records_path(@employee), params: {
      salary_record: { amount: "1", currency: "US", effective_from: "2025-01-01", reason: "Bad data" }
    }, as: :json

    assert_response :unprocessable_entity
    assert_equal "Validation failed", response.parsed_body["error"]
  end

  test "future salary does not replace current pay before its effective date" do
    @employee.salary_records.create!(amount: 170_000, currency: "USD", effective_from: Date.current + 30, reason: "Future adjustment")

    get api_v1_employees_path, params: { q: @employee.employee_number }

    assert_equal @salary.id, response.parsed_body.dig("data", 0, "current_salary", "id")
  end

  test "dashboard groups pay by native currency and department" do
    get api_v1_dashboard_path

    assert_response :success
    payload = response.parsed_body
    assert_equal 1, payload["headcount"]
    assert_includes payload["by_currency"].map { |row| row["currency"] }, "USD"
    assert_equal "Engineering", payload["by_department"].first["key"]
  end

  test "missing employee returns a consistent not found response" do
    get api_v1_employee_path(id: 999_999)

    assert_response :not_found
    assert_equal "Not found", response.parsed_body["error"]
  end
end
