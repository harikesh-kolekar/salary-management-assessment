ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

class ActiveSupport::TestCase
  parallelize(workers: 1)
  setup do
    {
      "US" => "United States", "GB" => "United Kingdom", "IN" => "India", "DE" => "Germany",
      "CA" => "Canada", "AU" => "Australia", "SG" => "Singapore", "JP" => "Japan"
    }.each { |code, name| Country.find_or_create_by!(code:) { |country| country.name = name } }
  end
end

module IntegrationAuthHeaders
  def process(method, path, **arguments)
    token = Thread.current[:salary_management_test_token]
    public_request = method == :post && (path.to_s.end_with?("/api/v1/session") || path.to_s.end_with?("/api/v1/organizations"))
    if token && !public_request
      arguments[:headers] = (arguments[:headers] || {}).merge("Authorization" => "Bearer #{token}")
    end
    super
  end
end

ActionDispatch::Integration::Session.prepend(IntegrationAuthHeaders)

class ActionDispatch::IntegrationTest
  setup do
    @test_organization = Organization.create!(name: "Test Organization", slug: "test-organization")
    salt = "deterministic-test-salt"
    @test_user = @test_organization.users.create!(
      full_name: "Test Manager",
      email: "manager@example.test",
      password_salt: salt,
      password_digest: User.digest_password("testing-password", salt)
    )
    Department::DEFAULT_NAMES.each { |name| @test_organization.departments.create!(name:, hr_manager: @test_user) }
    Thread.current[:salary_management_test_token] = Sessions::SessionToken.issue(@test_user)
  end

  teardown do
    Thread.current[:salary_management_test_token] = nil
  end
end
