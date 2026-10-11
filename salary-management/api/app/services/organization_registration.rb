class OrganizationRegistration
  Result = Struct.new(:organization, :user, :success, keyword_init: true) do
    def success?
      success
    end
  end

  def initialize(organization_name:, manager_name:, email:, password:, password_confirmation:)
    @organization_name = organization_name
    @manager_name = manager_name
    @email = email.to_s.strip.downcase
    @password = password
    @password_confirmation = password_confirmation
  end

  def call
    organization = Organization.new(name: @organization_name, slug: @organization_name.to_s.parameterize)
    user = organization.users.build(full_name: @manager_name, email: @email, password: @password, password_confirmation: @password_confirmation)
    success = false

    Organization.transaction do
      if organization.save && user.save
        success = true
      else
        organization.errors.each { |error| user.errors.add(:base, error.full_message) }
        raise ActiveRecord::Rollback
      end
    end

    Result.new(organization:, user:, success:)
  end
end
