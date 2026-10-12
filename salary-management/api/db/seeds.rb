# Deterministic, synthetic demo dataset. Safe to rerun: existing employee and
# effective-date keys are skipped rather than deleting an HR manager's edits.
countries = {
  "US" => { name: "United States", currency: "USD", base: 92_000 }, "GB" => { name: "United Kingdom", currency: "GBP", base: 62_000 },
  "IN" => { name: "India", currency: "INR", base: 1_450_000 }, "DE" => { name: "Germany", currency: "EUR", base: 74_000 },
  "CA" => { name: "Canada", currency: "CAD", base: 98_000 }, "AU" => { name: "Australia", currency: "AUD", base: 110_000 },
  "SG" => { name: "Singapore", currency: "SGD", base: 88_000 }, "JP" => { name: "Japan", currency: "JPY", base: 8_200_000 }
}.freeze
departments = Department::DEFAULT_NAMES
first_names = %w[Avery Jordan Taylor Morgan Casey Riley Quinn Cameron Jamie Alex Rowan Dakota]
last_names = %w[Kim Patel Garcia Chen Singh Brown Wilson Martin Davis Moore Taylor]
titles = ["Analyst", "Associate", "Senior Associate", "Manager", "Senior Manager", "Director", "Engineer", "Lead"]
timestamp = Time.utc(2025, 1, 1)
organization = Organization.find_or_create_by!(slug: "acme-corporation") { |record| record.name = "ACME Corporation" }
demo_password = "1234567890"
seed_demo_user = lambda do |email, full_name, role|
  user = if role == "admin"
    organization.admin_user || organization.users.find_or_initialize_by(email:)
  else
    organization.users.find_or_initialize_by(email:)
  end
  user.assign_attributes(email:, full_name:, role:)
  # The requested demo credential is shorter than the interactive account
  # password minimum. Seed its digest directly so this exception stays limited
  # to the explicitly seeded demo accounts.
  user.password_salt = SecureRandom.hex(16)
  user.password_digest = User.digest_password(demo_password, user.password_salt)
  user.save!
  user
end
admin = seed_demo_user.call("hr.manager@acme.test", "Jamie Davis", "admin")
hr_managers = {
  "engineering.hr@acme.test" => seed_demo_user.call("engineering.hr@acme.test", "Morgan Lee", "hr_manager"),
  "finance.hr@acme.test" => seed_demo_user.call("finance.hr@acme.test", "Taylor Patel", "hr_manager"),
  "people.hr@acme.test" => seed_demo_user.call("people.hr@acme.test", "Jordan Chen", "hr_manager")
}
countries.each do |code, details|
  Country.find_or_create_by!(code:) { |country| country.name = details.fetch(:name) }
end
departments.each do |name|
  department = organization.departments.find_or_initialize_by(name:)
  department.hr_manager = case name
  when "Engineering", "Product", "Support"
    hr_managers.fetch("engineering.hr@acme.test")
  when "Finance", "Sales"
    hr_managers.fetch("finance.hr@acme.test")
  else
    hr_managers.fetch("people.hr@acme.test")
  end
  department.save! if department.new_record? || department.changed?
end
country_ids = Country.pluck(:code, :id).to_h
department_ids = organization.departments.pluck(:name, :id).to_h

employees = Array.new(10_000) do |index|
  number = index + 1
  country_code = countries.keys[index % countries.size]
  {
    employee_number: "ACME-%05d" % number,
    organization_id: organization.id,
    first_name: first_names[(number * 7) % first_names.size],
    last_name: last_names[(number / 2) % last_names.size],
    email: "employee%05d@example.test" % number,
    country_id: country_ids.fetch(country_code),
    department_id: department_ids.fetch(departments[number % departments.size]),
    job_title: titles[(number * 5) % titles.size],
    status: number % 83 == 0 ? "leave" : "active",
    hired_on: Date.new(2016, 1, 1) + (number * 19) % 3_650,
    created_at: timestamp,
    updated_at: timestamp
  }
end

Employee.insert_all(employees, unique_by: :index_employees_on_organization_id_and_employee_number)
records = organization.employees.joins(:country).order(:employee_number).pluck("employees.id", "employees.employee_number", "countries.code").map do |id, employee_number, country_code|
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
puts "Demo users (password: #{demo_password}): #{[admin, *hr_managers.values].map { |user| "#{user.role}=#{user.email}" }.join(", ")}"
