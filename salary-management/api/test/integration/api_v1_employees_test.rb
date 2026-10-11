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

  test "employee details can be updated and the directory reflects changed values" do
    patch api_v1_employee_path(@employee), params: {
      employee: { country_code: "GB", department: "Legal", job_title: "Senior Counsel", status: "leave" }
    }, as: :json

    assert_response :success
    assert_equal "GB", response.parsed_body.dig("data", "country_code")
    assert_equal "leave", response.parsed_body.dig("data", "status")

    get api_v1_employees_path, params: { country: "GB", status: "leave", q: "maya" }
    assert_equal 1, response.parsed_body.dig("meta", "total")
    assert_equal "Legal", response.parsed_body.dig("data", 0, "department")
  end

  test "a new employee can be created without a salary record" do
    assert_difference("Employee.count", 1) do
      post api_v1_employees_path, params: {
        employee: {
          employee_number: "ACME-NEW-1", first_name: "Iris", last_name: "Wong",
          email: "iris.wong@example.test", country_code: "SG", department: "Legal",
          job_title: "Counsel", status: "active", hired_on: "2026-10-01"
        }
      }, as: :json
    end

    assert_response :created
    assert_equal "Iris Wong", response.parsed_body.dig("data", "full_name")
    assert_nil response.parsed_body.dig("data", "current_salary")
    assert_equal [], response.parsed_body.dig("data", "salary_history")
  end

  test "employee creation rejects invalid country and duplicate email" do
    post api_v1_employees_path, params: {
      employee: {
        employee_number: "ACME-NEW-2", first_name: "Iris", last_name: "Wong",
        email: @employee.email, country_code: "XX", department: "Legal",
        job_title: "Counsel", status: "active", hired_on: "2026-10-01"
      }
    }, as: :json

    assert_response :unprocessable_entity
    assert_equal 0, Employee.where(employee_number: "ACME-NEW-2").count
  end

  test "employee update rejects invalid values without changing the record" do
    patch api_v1_employee_path(@employee), params: { employee: { country_code: "XX", status: "unknown" } }, as: :json

    assert_response :unprocessable_entity
    assert_equal "US", @employee.reload.country_code
    assert_equal "active", @employee.status
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
