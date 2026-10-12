class EmployeeUpdater
  def initialize(organization:, id:, attributes:, departments: nil)
    @organization = organization
    @departments = departments || organization.departments
    @id = id
    @attributes = attributes
  end

  def call
    employee = @organization.employees.find(@id)
    attributes = @attributes.to_h.symbolize_keys
    if attributes.key?(:country_code)
      employee.country = Country.find_by(code: attributes.delete(:country_code))
      employee.errors.add(:country_code, "is invalid") unless employee.country
    end
    if attributes.key?(:department)
      employee.department = @departments.find_by(name: attributes.delete(:department))
      employee.errors.add(:department, "is not configured for this organization") unless employee.department
    end
    employee.assign_attributes(attributes)
    ServiceResult.new(value: employee, success: employee.errors.empty? && employee.save)
  end
end
