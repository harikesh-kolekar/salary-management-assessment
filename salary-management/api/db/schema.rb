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

ActiveRecord::Schema[8.1].define(version: 2026_10_11_000000) do
  create_table "employees", force: :cascade do |t|
    t.string "employee_number", null: false
    t.string "first_name", null: false
    t.string "last_name", null: false
    t.string "email", null: false
    t.string "country_code", limit: 2, null: false
    t.string "department", null: false
    t.string "job_title", null: false
    t.string "status", default: "active", null: false
    t.date "hired_on", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["country_code", "department", "status"], name: "index_employees_on_country_code_and_department_and_status"
    t.index ["email"], name: "index_employees_on_email", unique: true
    t.index ["employee_number"], name: "index_employees_on_employee_number", unique: true
    t.index ["last_name", "first_name"], name: "index_employees_on_last_name_and_first_name"
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

  add_foreign_key "salary_records", "employees"
end
