# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_10_12_010200) do
  create_table "countries", force: :cascade do |t|
    t.string "code", limit: 2, null: false
    t.string "name", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["code"], name: "index_countries_on_code", unique: true
  end

  create_table "departments", force: :cascade do |t|
    t.integer "organization_id", null: false
    t.integer "hr_manager_id", null: false
    t.string "name", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "code", null: false
    t.index ["hr_manager_id"], name: "index_departments_on_hr_manager_id"
    t.index ["organization_id", "code"], name: "index_departments_on_organization_id_and_code", unique: true
    t.index ["organization_id", "name"], name: "index_departments_on_organization_id_and_name", unique: true
    t.index ["organization_id"], name: "index_departments_on_organization_id"
  end

  create_table "employees", force: :cascade do |t|
    t.string "employee_number", null: false
    t.string "first_name", null: false
    t.string "last_name", null: false
    t.string "email", null: false
    t.string "job_title", null: false
    t.string "status", default: "active", null: false
    t.date "hired_on", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "organization_id", null: false
    t.integer "country_id", null: false
    t.integer "department_id", null: false
    t.index ["country_id"], name: "index_employees_on_country_id"
    t.index ["department_id"], name: "index_employees_on_department_id"
    t.index ["last_name", "first_name"], name: "index_employees_on_last_name_and_first_name"
    t.index ["organization_id", "country_id", "department_id", "status"], name: "index_employees_on_org_country_department_status"
    t.index ["organization_id", "email"], name: "index_employees_on_organization_id_and_email", unique: true
    t.index ["organization_id", "employee_number"], name: "index_employees_on_organization_id_and_employee_number", unique: true
    t.index ["organization_id"], name: "index_employees_on_organization_id"
  end

  create_table "organizations", force: :cascade do |t|
    t.string "name", null: false
    t.string "slug", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["slug"], name: "index_organizations_on_slug", unique: true
  end

  create_table "salary_records", force: :cascade do |t|
    t.integer "employee_id", null: false
    t.decimal "amount", precision: 15, scale: 2, null: false
    t.string "currency", limit: 3, null: false
    t.date "effective_from", null: false
    t.string "reason", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["currency", "effective_from"], name: "index_salary_records_on_currency_and_effective_from"
    t.index ["employee_id", "effective_from"], name: "index_salary_records_on_employee_id_and_effective_from", unique: true
    t.index ["employee_id"], name: "index_salary_records_on_employee_id"
  end

  create_table "users", force: :cascade do |t|
    t.integer "organization_id", null: false
    t.string "full_name", null: false
    t.string "email", null: false
    t.string "password_salt", null: false
    t.string "password_digest", null: false
    t.string "role", default: "admin", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["organization_id"], name: "index_users_on_organization_id"
    t.index ["organization_id"], name: "index_users_one_admin_per_organization", unique: true, where: "role = 'admin'"
  end

  add_foreign_key "departments", "organizations"
  add_foreign_key "departments", "users", column: "hr_manager_id"
  add_foreign_key "employees", "countries"
  add_foreign_key "employees", "departments"
  add_foreign_key "employees", "organizations"
  add_foreign_key "salary_records", "employees"
  add_foreign_key "users", "organizations"
end
