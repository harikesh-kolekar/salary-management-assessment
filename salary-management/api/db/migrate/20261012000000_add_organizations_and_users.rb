class AddOrganizationsAndUsers < ActiveRecord::Migration[8.1]
  def up
    create_table :organizations do |t|
      t.string :name, null: false
      t.string :slug, null: false
      t.timestamps
    end
    add_index :organizations, :slug, unique: true

    create_table :users do |t|
      t.references :organization, null: false, foreign_key: true
      t.string :full_name, null: false
      t.string :email, null: false
      t.string :password_salt, null: false
      t.string :password_digest, null: false
      t.string :role, null: false, default: "manager"
      t.timestamps
    end
    add_index :users, :email, unique: true

    add_reference :employees, :organization, foreign_key: true
    organization_id = connection.select_value("INSERT INTO organizations (name, slug, created_at, updated_at) VALUES ('ACME Corporation', 'acme-corporation', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id")
    execute("UPDATE employees SET organization_id = #{connection.quote(organization_id)}")
    change_column_null :employees, :organization_id, false

    remove_index :employees, name: "index_employees_on_email"
    remove_index :employees, name: "index_employees_on_employee_number"
    add_index :employees, [:organization_id, :email], unique: true
    add_index :employees, [:organization_id, :employee_number], unique: true
  end

  def down
    remove_index :employees, column: [:organization_id, :email]
    remove_index :employees, column: [:organization_id, :employee_number]
    add_index :employees, :email, unique: true
    add_index :employees, :employee_number, unique: true
    remove_reference :employees, :organization, foreign_key: true
    drop_table :users
    drop_table :organizations
  end
end
