class Employee < ApplicationRecord
  belongs_to :organization
  belongs_to :country
  belongs_to :department
  has_many :salary_records, -> { order(effective_from: :desc) }, dependent: :restrict_with_error

  STATUSES = %w[active leave terminated].freeze
  validates :employee_number, :first_name, :last_name, :email, :job_title, :hired_on, presence: true
  validates :employee_number, :email, uniqueness: { scope: :organization_id }
  validates :email, format: { with: /\A[^@\s]+@[^@\s]+\.[^@\s]+\z/ }
  validates :status, inclusion: { in: STATUSES }
  validate :department_must_belong_to_organization

  scope :active, -> { where(status: "active") }
  scope :on_roster, -> { where(status: %w[active leave]) }

  def current_salary_record(on: Date.current)
    salary_records.where(effective_from: ..on).first
  end

  private

  def department_must_belong_to_organization
    return unless department && organization_id && department.organization_id != organization_id

    errors.add(:department, "must belong to the same organization")
  end
end
