class Department < ApplicationRecord
  DEFAULT_NAMES = %w[Engineering Finance People Sales Operations Legal Marketing Product Support].freeze

  belongs_to :organization
  belongs_to :hr_manager, class_name: "User"
  has_many :employees, dependent: :restrict_with_error

  before_validation :assign_code, if: -> { code.blank? && name.present? }

  validates :name, presence: true, uniqueness: { scope: :organization_id }
  validates :code, presence: true, uniqueness: { scope: :organization_id }, format: { with: /\A[A-Z0-9_]+\z/ }
  validate :hr_manager_must_belong_to_organization

  private

  def assign_code
    self.code = name.parameterize(separator: "_").upcase
  end

  def hr_manager_must_belong_to_organization
    return unless hr_manager && organization_id && hr_manager.organization_id != organization_id

    errors.add(:hr_manager, "must belong to the same organization")
  end
end
