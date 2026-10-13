require "test_helper"

class SalaryRecordTest < ActiveSupport::TestCase
  setup do
    organization = Organization.create!(name: "Salary Test Org", slug: "salary-test-org")
    salt = "salary-test-salt"
    manager = organization.users.create!(
      full_name: "HR Manager", email: "salary-hr@example.test", password_salt: salt,
      password_digest: User.digest_password("testing-password", salt)
    )
    department = organization.departments.create!(name: "Finance", hr_manager: manager)
    @employee = Employee.create!(
      organization:,
      employee_number: "ACME-MODEL-1", first_name: "Sam", last_name: "Rivera",
      email: "sam.rivera@example.test", country: Country.find_by!(code: "GB"), department:,
      job_title: "Analyst", status: "active", hired_on: Date.new(2023, 6, 1)
    )
  end

  test "salary must be positive and use a three-character currency code" do
    record = @employee.salary_records.build(amount: 0, currency: "gbp", effective_from: Date.current, reason: "Test")

    assert_not record.valid?
    assert_includes record.errors.attribute_names, :amount
    assert_includes record.errors.attribute_names, :currency
  end

  test "a salary history cannot be inserted before an existing change" do
    @employee.salary_records.create!(amount: 50_000, currency: "GBP", effective_from: Date.new(2025, 1, 1), reason: "Initial")
    older = @employee.salary_records.build(amount: 48_000, currency: "GBP", effective_from: Date.new(2024, 1, 1), reason: "Backfill")

    assert_not older.valid?
    assert_includes older.errors[:effective_from], "must be later than existing salary changes"
  end
end
