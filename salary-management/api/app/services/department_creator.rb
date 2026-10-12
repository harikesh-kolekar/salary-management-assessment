class DepartmentCreator
  def initialize(organization:, attributes:)
    @organization = organization
    @attributes = attributes.to_h.symbolize_keys
  end

  def call
    department = @organization.departments.build(@attributes.except(:hr_manager_id))
    assign_hr_manager(department)
    ServiceResult.new(value: department, success: department.errors.empty? && department.save)
  end

  private

  def assign_hr_manager(department)
    manager = @organization.users.where(role: %w[admin hr_manager]).find_by(id: @attributes[:hr_manager_id])
    department.hr_manager = manager
    department.errors.add(:hr_manager, "must be an HR manager in this organization") unless manager
  end
end
