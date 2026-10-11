ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

class ActiveSupport::TestCase
  parallelize(workers: 1)
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
    Thread.current[:salary_management_test_token] = SessionToken.issue(@test_user)
  end

  teardown do
    Thread.current[:salary_management_test_token] = nil
  end
end
