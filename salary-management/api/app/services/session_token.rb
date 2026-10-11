class SessionToken
  LIFETIME = 12.hours

  def self.issue(user)
    verifier.generate({ user_id: user.id }, expires_in: LIFETIME, purpose: "api_session")
  end

  def self.authenticate(token)
    payload = verifier.verified(token, purpose: "api_session")
    User.find_by(id: payload&.fetch("user_id", nil))
  rescue ActiveSupport::MessageVerifier::InvalidSignature
    nil
  end

  def self.verifier
    ActiveSupport::MessageVerifier.new(Rails.application.secret_key_base, digest: "SHA256", serializer: JSON)
  end
  private_class_method :verifier
end
