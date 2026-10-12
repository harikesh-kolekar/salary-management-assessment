class DepartmentWriter
  def initialize(organization:, attributes:, id: nil)
    @organization = organization
    @attributes = attributes.to_h.symbolize_keys
    @id = id
  end

  def call
    department = @id ? @organization.departments.find(@id) : @organization.departments.build
    department.assign_attributes(@attributes.except(:hr_manager_id))
    assign_hr_manager(department) if @id.nil? || @attributes.key?(:hr_manager_id)

    success = department.errors.empty? && department.save
    ServiceResult.new(value: department, success:)
  end

  private

  def assign_hr_manager(department)
    manager = @organization.users.where(role: %w[admin hr_manager]).find_by(id: @attributes[:hr_manager_id])
    department.hr_manager = manager
    department.errors.add(:hr_manager, "must be an HR manager in this organization") unless manager
  end
end
