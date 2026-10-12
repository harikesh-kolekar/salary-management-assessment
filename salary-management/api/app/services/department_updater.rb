class DepartmentUpdater
  def initialize(organization:, id:, attributes:)
    @organization = organization
    @id = id
    @attributes = attributes.to_h.symbolize_keys
  end

  def call
    department = @organization.departments.find(@id)
    department.assign_attributes(@attributes.except(:hr_manager_id))
    assign_hr_manager(department) if @attributes.key?(:hr_manager_id)
    ServiceResult.new(value: department, success: department.errors.empty? && department.save)
  end

  private

  def assign_hr_manager(department)
    manager = @organization.users.where(role: %w[admin hr_manager]).find_by(id: @attributes[:hr_manager_id])
    department.hr_manager = manager
    department.errors.add(:hr_manager, "must be an HR manager in this organization") unless manager
  end
end
