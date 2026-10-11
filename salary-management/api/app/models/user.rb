require "base64"
require "securerandom"

class User < ApplicationRecord
  PASSWORD_ITERATIONS = 210_000
  PASSWORD_LENGTH = 32

  belongs_to :organization

  attr_accessor :password, :password_confirmation

  before_validation :hash_password, if: -> { password.present? }

  validates :full_name, presence: true, length: { maximum: 120 }
  validates :email, presence: true, uniqueness: true, format: { with: /\A[^@\s]+@[^@\s]+\.[^@\s]+\z/ }
  validates :role, inclusion: { in: %w[manager] }
  validates :password_digest, presence: true, on: :create
  validates :password, length: { minimum: 10 }, if: -> { password.present? }
  validates :password_confirmation, presence: true, if: -> { new_record? && password.present? }
  validate :password_confirmation_matches, if: -> { password.present? }

  def authenticate(candidate)
    return false unless candidate.is_a?(String) && password_digest.present? && password_salt.present?

    expected = self.class.digest_password(candidate, password_salt)
    ActiveSupport::SecurityUtils.secure_compare(password_digest, expected) ? self : false
  end

  def self.digest_password(password, salt)
    Base64.strict_encode64(OpenSSL::KDF.pbkdf2_hmac(password, salt:, iterations: PASSWORD_ITERATIONS, length: PASSWORD_LENGTH, hash: "sha256"))
  end

  private

  def hash_password
    self.password_salt = SecureRandom.hex(16)
    self.password_digest = self.class.digest_password(password, password_salt)
  end

  def password_confirmation_matches
    errors.add(:password_confirmation, "does not match password") if password_confirmation.present? && password != password_confirmation
  end
end
