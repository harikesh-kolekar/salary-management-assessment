class HrManagerCreator
  def initialize(organization:, attributes:)
    @organization = organization
    @attributes = attributes
  end

  def call
    user = @organization.users.build(@attributes.merge(role: "hr_manager"))
    ServiceResult.new(value: user, success: user.save)
  end
end
