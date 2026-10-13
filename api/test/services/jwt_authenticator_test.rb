require "test_helper"

class JwtAuthenticatorTest < ActiveSupport::TestCase
  setup do
    @organization = Organization.create!(name: "JWT Test Org", slug: "jwt-test-org")
    salt = "jwt-test-salt"
    @user = @organization.users.create!(
      full_name: "JWT User", email: "jwt-user@example.test", role: "admin",
      password_salt: salt, password_digest: User.digest_password("testing-password", salt)
    )
  end

  test "issues an HS256 JWT with subject, tenant, issuer, audience, and expiry claims" do
    token = Sessions::JwtAuthenticator.issue(@user)
    payload, header = JWT.decode(token, Rails.application.secret_key_base, true, { algorithm: "HS256" })

    assert_equal "HS256", header.fetch("alg")
    assert_equal @user.id.to_s, payload.fetch("sub")
    assert_equal @organization.id, payload.fetch("organization_id")
    assert_equal Sessions::JwtAuthenticator::ISSUER, payload.fetch("iss")
    assert_equal Sessions::JwtAuthenticator::AUDIENCE, payload.fetch("aud")
    assert_operator payload.fetch("exp"), :>, Time.current.to_i
    assert_equal @user, Sessions::JwtAuthenticator.authenticate(token)
  end

  test "rejects expired and forged JWTs" do
    claims = {
      sub: @user.id.to_s,
      organization_id: @organization.id,
      iss: Sessions::JwtAuthenticator::ISSUER,
      aud: Sessions::JwtAuthenticator::AUDIENCE,
      iat: 2.minutes.ago.to_i,
      exp: 1.minute.ago.to_i
    }
    expired = JWT.encode(claims, Rails.application.secret_key_base, "HS256")
    forged = JWT.encode(claims.merge(exp: 1.hour.from_now.to_i), "wrong-signing-secret", "HS256")

    assert_nil Sessions::JwtAuthenticator.authenticate(expired)
    assert_nil Sessions::JwtAuthenticator.authenticate(forged)
  end

  test "does not authenticate a token with a different organization claim" do
    token = JWT.encode(
      {
        sub: @user.id.to_s,
        organization_id: @organization.id + 1,
        iss: Sessions::JwtAuthenticator::ISSUER,
        aud: Sessions::JwtAuthenticator::AUDIENCE,
        iat: Time.current.to_i,
        exp: 1.hour.from_now.to_i
      },
      Rails.application.secret_key_base,
      "HS256"
    )

    assert_nil Sessions::JwtAuthenticator.authenticate(token)
  end
end
