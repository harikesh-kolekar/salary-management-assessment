require "test_helper"

class ApiV1EmployeesTest < ActionDispatch::IntegrationTest
  setup do
    @employee = Employee.create!(
      organization: @test_organization,
      employee_number: "ACME-TEST-1", first_name: "Maya", last_name: "Chen",
      email: "maya.chen@example.test", country: Country.find_by!(code: "US"), department: @test_organization.departments.find_by!(name: "Engineering"),
      job_title: "Staff Engineer", status: "active", hired_on: Date.new(2020, 3, 1)
    )
    @salary = @employee.salary_records.create!(amount: 150_000, currency: "USD", effective_from: Date.new(2025, 1, 1), reason: "Annual review")
  end

  test "reference data includes countries and organization departments with their HR managers" do
    get "/api/v1/reference_data"

    assert_response :success
    payload = response.parsed_body
    assert_includes payload.fetch("countries").map { |country| country.fetch("code") }, "US"
    engineering = payload.fetch("departments").find { |item| item.fetch("name") == "Engineering" }
    assert_equal "ENGINEERING", engineering.fetch("code")
    assert_equal @test_user.id, engineering.dig("hr_manager", "id")
    assert_equal "Test Manager", engineering.dig("hr_manager", "full_name")
    assert_includes payload.fetch("hr_managers").map { |manager| manager.fetch("id") }, @test_user.id
  end

  test "HR managers see employees and compensation only in departments they manage" do
    hr_manager = create_hr_manager("engineering-hr@example.test")
    engineering = @test_organization.departments.find_by!(name: "Engineering")
    engineering.update!(hr_manager: hr_manager)
    legal = @test_organization.departments.find_by!(name: "Legal")
    legal.update!(hr_manager: hr_manager)
    finance = @test_organization.departments.find_by!(name: "Finance")
    outside = create_employee("ACME-FIN-1", finance)
    visible = [@employee, create_employee("ACME-LEGAL-1", legal)]
    Thread.current[:salary_management_test_token] = SessionToken.issue(hr_manager)

    get api_v1_employees_path
    assert_equal visible.map(&:id).sort, response.parsed_body.fetch("data").map { |row| row.fetch("id") }.sort

    get api_v1_employee_path(outside)
    assert_response :not_found
    post api_v1_employee_salary_records_path(outside), params: {
      salary_record: { amount: "120000", currency: "USD", effective_from: Date.current + 1, reason: "Raise" }
    }, as: :json
    assert_response :not_found

    get api_v1_dashboard_path
    assert_equal 2, response.parsed_body.fetch("employee_count")
    assert_equal 2, response.parsed_body.fetch("headcount")
  end

  test "HR manager reference data is limited to managed departments in their organization" do
    hr_manager = create_hr_manager("reference-hr@example.test")
    engineering = @test_organization.departments.find_by!(name: "Engineering")
    engineering.update!(hr_manager: hr_manager)
    finance = @test_organization.departments.find_by!(name: "Finance")

    other_organization = Organization.create!(name: "Different Org", slug: "different-org")
    other_manager = other_organization.users.create!(
      full_name: "Different HR", email: "different-hr@example.test", role: "hr_manager",
      password_salt: "different-hr-salt", password_digest: User.digest_password("testing-password", "different-hr-salt")
    )
    other_organization.departments.create!(name: "Engineering", hr_manager: other_manager)
    Thread.current[:salary_management_test_token] = SessionToken.issue(hr_manager)

    get "/api/v1/reference_data"

    assert_response :success
    department_names = response.parsed_body.fetch("departments").map { |department| department.fetch("name") }
    assert_equal ["Engineering"], department_names
    assert_not_includes department_names, finance.name
  end

  test "HR manager cannot move a visible employee to a department they do not manage" do
    hr_manager = create_hr_manager("update-hr@example.test")
    @test_organization.departments.find_by!(name: "Engineering").update!(hr_manager: hr_manager)
    Thread.current[:salary_management_test_token] = SessionToken.issue(hr_manager)

    patch api_v1_employee_path(@employee), params: { employee: { department: "Finance" } }, as: :json

    assert_response :unprocessable_entity
    assert_equal "Engineering", @employee.reload.department.name
  end

  test "HR managers cannot create employees outside their assigned departments" do
    hr_manager = create_hr_manager("limited-hr@example.test")
    Thread.current[:salary_management_test_token] = SessionToken.issue(hr_manager)

    assert_no_difference("Employee.count") do
      post api_v1_employees_path, params: {
        employee: {
          employee_number: "ACME-OUTSIDE-1", first_name: "Rae", last_name: "Kim",
          email: "rae.kim@example.test", country_code: "US", department: "Finance",
          job_title: "Analyst", status: "active", hired_on: Date.current
        }
      }, as: :json
    end

    assert_response :unprocessable_entity
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

  test "employee can be created with an initial salary in the same request" do
    assert_difference(["Employee.count", "SalaryRecord.count"], 1) do
      post api_v1_employees_path, params: {
        employee: {
          employee_number: "ACME-NEW-PAY", first_name: "Iris", last_name: "Wong",
          email: "iris.pay@example.test", country_code: "GB", department: "Legal",
          job_title: "Counsel", status: "active", hired_on: "2026-10-01"
        },
        initial_salary: { amount: "90000", currency: "GBP", effective_from: "2026-10-01", reason: "Initial compensation" }
      }, as: :json
    end

    assert_response :created
    assert_equal 90_000.0, response.parsed_body.dig("data", "current_salary", "amount")
    assert_equal 1, response.parsed_body.dig("data", "salary_history").length
  end

  test "invalid initial salary rolls back employee creation" do
    assert_no_difference(["Employee.count", "SalaryRecord.count"]) do
      post api_v1_employees_path, params: {
        employee: {
          employee_number: "ACME-NEW-BAD-PAY", first_name: "Iris", last_name: "Wong",
          email: "iris.badpay@example.test", country_code: "US", department: "Finance",
          job_title: "Analyst", status: "active", hired_on: "2026-10-01"
        },
        initial_salary: { amount: "0", currency: "USD", effective_from: "2026-10-01", reason: "Initial compensation" }
      }, as: :json
    end

    assert_response :unprocessable_entity
    assert_not Employee.exists?(employee_number: "ACME-NEW-BAD-PAY")
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

  test "employee creation rejects a department outside the configured list" do
    assert_no_difference("Employee.count") do
      post api_v1_employees_path, params: {
        employee: {
          employee_number: "ACME-NEW-3", first_name: "Iris", last_name: "Wong",
          email: "iris.wong@example.test", country_code: "US", department: "Unassigned",
          job_title: "Counsel", status: "active", hired_on: "2026-10-01"
        }
      }, as: :json
    end

    assert_response :unprocessable_entity
    assert_includes response.parsed_body.dig("details", "department"), "is not configured for this organization"
  end

  test "employee update rejects invalid values without changing the record" do
    patch api_v1_employee_path(@employee), params: { employee: { country_code: "XX", status: "unknown", department: "Unassigned" } }, as: :json

    assert_response :unprocessable_entity
    assert_equal "US", @employee.reload.country.code
    assert_equal "active", @employee.status
    assert_equal "Engineering", @employee.department.name
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

  private

  def create_hr_manager(email)
    salt = "salt-#{email}"
    @test_organization.users.create!(
      full_name: "Assigned HR", email:, role: "hr_manager", password_salt: salt,
      password_digest: User.digest_password("testing-password", salt)
    )
  end

  def create_employee(number, department)
    @test_organization.employees.create!(
      employee_number: number, first_name: "Robin", last_name: "Lee", email: "#{number.downcase}@example.test",
      country: Country.find_by!(code: "US"), department:, job_title: "Analyst", status: "active", hired_on: Date.current
    ).tap do |employee|
      employee.salary_records.create!(amount: 100_000, currency: "USD", effective_from: Date.current, reason: "Initial")
    end
  end
end
