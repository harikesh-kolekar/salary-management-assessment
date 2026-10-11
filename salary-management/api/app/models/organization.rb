class Organization < ApplicationRecord
  has_many :users, dependent: :destroy
  has_many :employees, dependent: :restrict_with_error

  validates :name, presence: true, length: { maximum: 120 }
  validates :slug, presence: true, uniqueness: true
end
