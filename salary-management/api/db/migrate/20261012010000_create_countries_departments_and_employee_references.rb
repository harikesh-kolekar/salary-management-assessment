class CreateCountriesDepartmentsAndEmployeeReferences < ActiveRecord::Migration[8.1]
  COUNTRIES = {
    "US" => "United States", "GB" => "United Kingdom", "IN" => "India", "DE" => "Germany",
    "CA" => "Canada", "AU" => "Australia", "SG" => "Singapore", "JP" => "Japan"
  }.freeze
  DEFAULT_DEPARTMENTS = %w[Engineering Finance People Sales Operations Legal Marketing Product Support].freeze

  def up
    create_table :countries do |t|
      t.string :code, limit: 2, null: false
      t.string :name, null: false
      t.timestamps
    end
    add_index :countries, :code, unique: true
    COUNTRIES.each do |code, name|
      execute "INSERT INTO countries (code, name, created_at, updated_at) VALUES (#{connection.quote(code)}, #{connection.quote(name)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    end

    execute "UPDATE users SET role = 'admin' WHERE role = 'manager'"
    change_column_default :users, :role, from: "manager", to: "admin"
    add_index :users, :organization_id, unique: true, where: "role = 'admin'", name: "index_users_one_admin_per_organization"

    create_table :departments do |t|
      t.references :organization, null: false, foreign_key: true
      t.references :hr_manager, null: false, foreign_key: { to_table: :users }
      t.string :name, null: false
      t.timestamps
    end
    add_index :departments, [:organization_id, :name], unique: true

    select_all("SELECT id FROM organizations").each do |organization|
      organization_id = organization.fetch("id")
      manager_id = select_value("SELECT id FROM users WHERE organization_id = #{connection.quote(organization_id)} AND role = 'admin' ORDER BY id LIMIT 1")
      DEFAULT_DEPARTMENTS.each do |name|
        execute <<~SQL
          INSERT OR IGNORE INTO departments (organization_id, hr_manager_id, name, created_at, updated_at)
          VALUES (#{connection.quote(organization_id)}, #{connection.quote(manager_id)}, #{connection.quote(name)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        SQL
      end
    end

    add_reference :employees, :country, foreign_key: true
    add_reference :employees, :department, foreign_key: true

    select_all("SELECT DISTINCT organization_id, department FROM employees").each do |row|
      organization_id = row.fetch("organization_id")
      name = row.fetch("department")
      manager_id = select_value("SELECT id FROM users WHERE organization_id = #{connection.quote(organization_id)} AND role = 'admin' ORDER BY id LIMIT 1")
      execute <<~SQL
        INSERT OR IGNORE INTO departments (organization_id, hr_manager_id, name, created_at, updated_at)
        VALUES (#{connection.quote(organization_id)}, #{connection.quote(manager_id)}, #{connection.quote(name)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      SQL
    end

    execute <<~SQL
      UPDATE employees
      SET country_id = (SELECT id FROM countries WHERE countries.code = employees.country_code),
          department_id = (SELECT id FROM departments WHERE departments.organization_id = employees.organization_id AND departments.name = employees.department)
    SQL
    change_column_null :employees, :country_id, false
    change_column_null :employees, :department_id, false

    remove_index :employees, name: "index_employees_on_country_code_and_department_and_status"
    remove_column :employees, :country_code
    remove_column :employees, :department
    add_index :employees, [:organization_id, :country_id, :department_id, :status], name: "index_employees_on_org_country_department_status"
  end

  def down
    remove_index :employees, name: "index_employees_on_org_country_department_status"
    add_column :employees, :country_code, :string, limit: 2
    add_column :employees, :department, :string
    execute <<~SQL
      UPDATE employees
      SET country_code = (SELECT code FROM countries WHERE countries.id = employees.country_id),
          department = (SELECT name FROM departments WHERE departments.id = employees.department_id)
    SQL
    remove_reference :employees, :country, foreign_key: true
    remove_reference :employees, :department, foreign_key: true
    add_index :employees, [:country_code, :department, :status], name: "index_employees_on_country_code_and_department_and_status"
    drop_table :departments
    drop_table :countries
    change_column_default :users, :role, from: "admin", to: "manager"
    execute "UPDATE users SET role = 'manager' WHERE role = 'admin'"
  end
end
