require "jwt"

module Sessions
  class JwtAuthenticator
    ALGORITHM = "HS256".freeze
    ISSUER = "salary-management".freeze
    AUDIENCE = "salary-management-api".freeze
    LIFETIME = 15.minutes

    def self.issue(user)
      now = Time.current.to_i
      payload = {
        sub: user.id.to_s,
        organization_id: user.organization_id,
        iss: ISSUER,
        aud: AUDIENCE,
        iat: now,
        exp: now + LIFETIME.to_i
      }
      JWT.encode(payload, signing_secret, ALGORITHM)
    end

    def self.authenticate(token)
      payload, = JWT.decode(token, signing_secret, true, decode_options)
      user_id = Integer(payload.fetch("sub"))
      organization_id = Integer(payload.fetch("organization_id"))
      User.find_by(id: user_id, organization_id:)
    rescue JWT::DecodeError, ArgumentError, TypeError, KeyError
      nil
    end

    def self.signing_secret
      Rails.application.secret_key_base
    end
    private_class_method :signing_secret

    def self.decode_options
      {
        algorithm: ALGORITHM,
        iss: ISSUER,
        verify_iss: true,
        aud: AUDIENCE,
        verify_aud: true,
        verify_iat: true,
        required_claims: %w[sub organization_id iss aud iat exp]
      }
    end
    private_class_method :decode_options
  end
end
