require "test_helper"

class RefreshTokenManagerTest < ActiveSupport::TestCase
  setup do
    organization = Organization.create!(name: "Refresh Test Org", slug: "refresh-test-org")
    salt = "refresh-test-salt"
    @user = organization.users.create!(
      full_name: "Refresh User", email: "refresh-user@example.test", role: "admin",
      password_salt: salt, password_digest: User.digest_password("testing-password", salt)
    )
  end

  test "stores a digest of the refresh token and rotates it once" do
    first = Sessions::RefreshTokenManager.issue(@user)
    first_record = RefreshToken.find_by!(user: @user)

    assert_not_equal first.refresh_token, first_record.token_digest
    assert_equal Digest::SHA256.hexdigest(first.refresh_token), first_record.token_digest

    rotated = Sessions::RefreshTokenManager.rotate(first.refresh_token)

    assert_equal @user, rotated.user
    assert_not_equal first.refresh_token, rotated.refresh_token
    assert first_record.reload.revoked?
    assert_nil Sessions::RefreshTokenManager.rotate(first.refresh_token)
    assert_nil Sessions::RefreshTokenManager.rotate(rotated.refresh_token)
  end

  test "rejects expired refresh tokens" do
    issued = Sessions::RefreshTokenManager.issue(@user)
    RefreshToken.find_by!(user: @user).update!(expires_at: 1.minute.ago)

    assert_nil Sessions::RefreshTokenManager.rotate(issued.refresh_token)
  end

  test "revokes a token family on logout" do
    issued = Sessions::RefreshTokenManager.issue(@user)

    assert Sessions::RefreshTokenManager.revoke(issued.refresh_token)
    assert_nil Sessions::RefreshTokenManager.rotate(issued.refresh_token)
    assert_not Sessions::RefreshTokenManager.revoke("unknown-token")
  end
end
