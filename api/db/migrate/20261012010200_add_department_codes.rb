class AddDepartmentCodes < ActiveRecord::Migration[8.1]
  def up
    add_column :departments, :code, :string

    select_all("SELECT id, organization_id, name FROM departments ORDER BY id").each do |department|
      base_code = department.fetch("name").parameterize(separator: "_").upcase
      code = base_code
      suffix = 2
      while select_value("SELECT 1 FROM departments WHERE organization_id = #{connection.quote(department.fetch('organization_id'))} AND code = #{connection.quote(code)}")
        code = "#{base_code}_#{suffix}"
        suffix += 1
      end
      execute "UPDATE departments SET code = #{connection.quote(code)} WHERE id = #{connection.quote(department.fetch('id'))}"
    end

    change_column_null :departments, :code, false
    add_index :departments, [:organization_id, :code], unique: true
  end

  def down
    remove_index :departments, column: [:organization_id, :code]
    remove_column :departments, :code
  end
end
