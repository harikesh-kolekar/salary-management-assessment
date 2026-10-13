class CreateEmployees < ActiveRecord::Migration[8.1]
  def change
    create_table :employees do |t|
      t.string :employee_number, null: false
      t.string :first_name, null: false
      t.string :last_name, null: false
      t.string :email, null: false
      t.string :country_code, null: false, limit: 2
      t.string :department, null: false
      t.string :job_title, null: false
      t.string :status, null: false, default: "active"
      t.date :hired_on, null: false
      t.timestamps
    end

    add_index :employees, :employee_number, unique: true
    add_index :employees, %i[country_code department status]
    add_index :employees, %i[last_name first_name]
    add_index :employees, :email, unique: true

    create_table :salary_records do |t|
      t.references :employee, null: false, foreign_key: true
      t.decimal :amount, precision: 15, scale: 2, null: false
      t.string :currency, null: false, limit: 3
      t.date :effective_from, null: false
      t.string :reason, null: false
      t.timestamps
    end

    add_index :salary_records, %i[employee_id effective_from], unique: true
    add_index :salary_records, %i[currency effective_from]
  end
end
