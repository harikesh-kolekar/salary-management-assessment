class RefreshToken < ApplicationRecord
  belongs_to :user

  validates :token_digest, :family_id, :expires_at, presence: true
  validates :token_digest, uniqueness: true

  def expired?
    expires_at <= Time.current
  end

  def revoked?
    revoked_at.present?
  end
end
