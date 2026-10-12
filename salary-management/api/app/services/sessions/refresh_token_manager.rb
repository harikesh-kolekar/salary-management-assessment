require "digest"
require "securerandom"

module Sessions
  class RefreshTokenManager
    LIFETIME = 30.days
    Rotation = Struct.new(:user, :refresh_token, keyword_init: true)

    def self.issue(user)
      persist(user, SecureRandom.uuid)
    end

    def self.rotate(raw_token)
      return if raw_token.blank?

      refresh_token = RefreshToken.find_by(token_digest: digest(raw_token))
      return unless refresh_token

      refresh_token.with_lock do
        now = Time.current
        if refresh_token.revoked?
          revoke_family(refresh_token.family_id, now)
          next nil
        end
        if refresh_token.expired?
          refresh_token.update!(revoked_at: now)
          next nil
        end

        rotation = persist(refresh_token.user, refresh_token.family_id)
        refresh_token.update!(revoked_at: now)
        rotation
      end
    end

    def self.revoke(raw_token)
      return false if raw_token.blank?

      refresh_token = RefreshToken.find_by(token_digest: digest(raw_token))
      return false unless refresh_token

      refresh_token.with_lock do
        revoke_family(refresh_token.family_id, Time.current)
      end
      true
    end

    def self.persist(user, family_id)
      raw_token = SecureRandom.urlsafe_base64(64)
      user.refresh_tokens.create!(
        token_digest: digest(raw_token),
        family_id:,
        expires_at: LIFETIME.from_now
      )
      Rotation.new(user:, refresh_token: raw_token)
    end
    private_class_method :persist

    def self.digest(raw_token)
      Digest::SHA256.hexdigest(raw_token)
    end
    private_class_method :digest

    def self.revoke_family(family_id, at)
      RefreshToken.where(family_id:, revoked_at: nil).update_all(revoked_at: at, updated_at: at)
    end
    private_class_method :revoke_family
  end
end
