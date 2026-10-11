# Deterministic, synthetic demo dataset. Safe to rerun: existing employee and
# effective-date keys are skipped rather than deleting an HR manager's edits.
countries = {
  "US" => { currency: "USD", base: 92_000 }, "GB" => { currency: "GBP", base: 62_000 },
  "IN" => { currency: "INR", base: 1_450_000 }, "DE" => { currency: "EUR", base: 74_000 },
  "CA" => { currency: "CAD", base: 98_000 }, "AU" => { currency: "AUD", base: 110_000 },
  "SG" => { currency: "SGD", base: 88_000 }, "JP" => { currency: "JPY", base: 8_200_000 }
}.freeze
departments = %w[Engineering Finance People Sales Operations Legal Marketing Product Support]
first_names = %w[Avery Jordan Taylor Morgan Casey Riley Quinn Cameron Jamie Alex Rowan Dakota]
last_names = %w[Kim Patel Garcia Chen Singh Brown Wilson Martin Davis Moore Taylor]
titles = ["Analyst", "Associate", "Senior Associate", "Manager", "Senior Manager", "Director", "Engineer", "Lead"]
timestamp = Time.utc(2025, 1, 1)
organization = Organization.find_or_create_by!(slug: "acme-corporation") { |record| record.name = "ACME Corporation" }
manager = organization.users.find_or_initialize_by(email: "hr.manager@acme.test")
if manager.new_record?
  manager.full_name = "Jamie Davis"
  manager.password = "acme-demo-2026"
  manager.password_confirmation = "acme-demo-2026"
  manager.save!
end

employees = Array.new(10_000) do |index|
  number = index + 1
  country_code = countries.keys[index % countries.size]
  {
    employee_number: "ACME-%05d" % number,
    organization_id: organization.id,
    first_name: first_names[(number * 7) % first_names.size],
    last_name: last_names[(number / 2) % last_names.size],
    email: "employee%05d@example.test" % number,
    country_code: country_code,
    department: departments[number % departments.size],
    job_title: titles[(number * 5) % titles.size],
    status: number % 83 == 0 ? "leave" : "active",
    hired_on: Date.new(2016, 1, 1) + (number * 19) % 3_650,
    created_at: timestamp,
    updated_at: timestamp
  }
end

Employee.insert_all(employees, unique_by: :index_employees_on_organization_id_and_employee_number)
records = organization.employees.order(:employee_number).pluck(:id, :employee_number, :country_code).map do |id, employee_number, country_code|
  number = employee_number.delete_prefix("ACME-").to_i
  region = countries.fetch(country_code)
  amount = region[:base] * (0.72 + ((number * 37) % 70) / 100.0)
  {
    employee_id: id,
    amount: amount.round(2),
    currency: region[:currency],
    effective_from: Date.new(2025, 1, 1),
    reason: "Initial synthetic salary",
    created_at: timestamp,
    updated_at: timestamp
  }
end
SalaryRecord.insert_all(records, unique_by: :index_salary_records_on_employee_id_and_effective_from)

puts "Seeded #{organization.employees.count} synthetic employees for #{organization.name} and #{SalaryRecord.joins(:employee).where(employees: { organization_id: organization.id }).count} salary records."
