class RequireDepartmentHrManager < ActiveRecord::Migration[8.1]
  def up
    change_column_null :departments, :hr_manager_id, false
  end

  def down
    change_column_null :departments, :hr_manager_id, true
  end
end
